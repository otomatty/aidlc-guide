import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildMatrixForUnit } from "../src/tree/matrix.ts";
import {
  readReviewVerdicts,
  reviewCellKey,
  reviewUnitsInAuditShard,
} from "../src/tree/review-records.ts";
import { expectOk } from "./paths.ts";
import { reviewAudit, reviewFixture } from "./review-fixtures.ts";

describe("matrix v2.8.2 review records", () => {
  let root: string;
  let record: string;
  const configureIteration = async (iteration: "stage-major" | "unit-major") =>
    writeFile(
      path.join(record, "aidlc-state.md"),
      `## Scope Configuration\n- **Change Control**: relaxed (set by you)\n\n## Runtime State\n- **Construction Iteration**: ${iteration}\n`,
    );
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "guide-reviews-"));
    record = path.join(root, "aidlc", "spaces", "default", "intents", "review-12345678");
    await mkdir(path.join(record, "construction", "unit-alpha", "functional-design"), {
      recursive: true,
    });
    await mkdir(path.join(record, "audit"), { recursive: true });
    await configureIteration("stage-major");
    await writeFile(
      path.join(record, "construction", "unit-alpha", "functional-design", "design.md"),
      "## Review\n**Verdict:** NOT-READY\n",
    );
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const read = async () =>
    expectOk(await buildMatrixForUnit(record, "unit-alpha", ["functional-design"])).value[0]
      ?.verdict;
  const audit = async (text: string) => writeFile(path.join(record, "audit", "clone.md"), text);
  const save = async (fixture: ReturnType<typeof reviewFixture>) => {
    const file = path.join(record, fixture.relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, fixture.bytes);
    return file;
  };

  it("uses the verified JSON instead of an older embedded verdict", async () => {
    const fixture = reviewFixture();
    await save(fixture);
    await audit(fixture.request + fixture.completion);
    expect(await read()).toBe("READY");
  });

  it("preserves a genuinely legacy embedded review", async () => {
    await audit(
      reviewAudit("REVIEW_COMPLETED", {
        Stage: "functional-design",
        Unit: "unit-alpha",
        Verdict: "NOT-READY",
      }),
    );
    expect(await read()).toBe("NOT-READY");
  });

  it("does not inherit a stage-level or another unit's review", async () => {
    const stage = reviewFixture({ unit: null });
    const other = reviewFixture({ unit: "unit-beta", id: "b" });
    await save(stage);
    await save(other);
    await audit(stage.request + stage.completion + other.request + other.completion);
    expect(await read()).toBe("NOT-READY");
  });

  it.each(["missing", "digest", "malformed", "scope", "attempt", "findings"])(
    "clears a modern review whose JSON is %s without resurrecting legacy text",
    async (kind) => {
      const fixture = reviewFixture();
      let bytes = fixture.bytes;
      if (kind === "digest") bytes += " ";
      if (kind === "malformed") bytes = "{";
      if (kind === "scope") bytes = JSON.stringify({ ...fixture.record, unit: "unit-beta" });
      if (kind === "attempt")
        bytes = JSON.stringify({ ...fixture.record, attempt: "b".repeat(16) });
      if (kind === "findings")
        bytes = JSON.stringify({ ...fixture.record, findings: [{ id: "bad" }] });
      if (kind !== "missing") await save({ ...fixture, bytes });
      const fields = { ...fixture.completionFields };
      if (kind !== "digest")
        fields["Review Record Digest"] =
          `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
      await audit(fixture.request + reviewAudit("REVIEW_COMPLETED", fields, 2));
      expect(await read()).toBeNull();
    },
  );

  it("does not read orphan JSON without a paired request and completion", async () => {
    const fixture = reviewFixture();
    await save(fixture);
    expect(await read()).toBeNull();
    await audit(fixture.completion);
    expect(await read()).toBeNull();
  });

  it.each(["verdict", "reference", "digest"])(
    "does not consume the request on a malformed %s before a valid completion",
    async (kind) => {
      const fixture = reviewFixture();
      await save(fixture);
      const fields = { ...fixture.completionFields };
      if (kind === "verdict") fields.Verdict = "invalid" as "READY";
      if (kind === "reference") fields["Review Record"] = "bad.json";
      if (kind === "digest") fields["Review Record Digest"] = `sha256:${"b".repeat(64)}`;
      await audit(
        fixture.request +
          reviewAudit("REVIEW_COMPLETED", fields, 2) +
          reviewAudit("REVIEW_COMPLETED", fixture.completionFields, 3),
      );
      expect(await read()).toBe("READY");
    },
  );

  it("pairs Request Id, leaving a newer pending attempt empty even if an old completion arrives late", async () => {
    const previous = reviewFixture();
    const next = reviewFixture({ id: "b", attempt: "b".repeat(16), second: 3 });
    await save(previous);
    await save(next);
    await audit(previous.request + previous.completion + next.request);
    expect(await read()).toBeNull();
    await audit(
      previous.request +
        next.request +
        reviewAudit("REVIEW_COMPLETED", previous.completionFields, 4),
    );
    expect(await read()).toBeNull();
    await audit(previous.request + previous.completion + next.request + next.completion);
    expect(await read()).toBe("READY");
  });

  it.each(["STAGE_STARTED", "GATE_REJECTED", "WORKFLOW_STARTED", "STAGE_JUMPED"])(
    "invalidates the prior verdict after %s",
    async (event) => {
      const fixture = reviewFixture();
      await save(fixture);
      await audit(
        fixture.request +
          fixture.completion +
          reviewAudit(event, { Stage: "functional-design", "Attempt Generation": "2" }, 3),
      );
      expect(await read()).toBeNull();
    },
  );

  it("keeps a different unit's scoped rejection separate", async () => {
    const fixture = reviewFixture();
    await save(fixture);
    await audit(
      fixture.request +
        fixture.completion +
        reviewAudit("GATE_REJECTED", { Stage: "functional-design", Unit: "unit-beta" }, 3),
    );
    expect(await read()).toBe("READY");
  });

  it.each(["completed", "pending"])(
    "preserves unit-major %s reviews across a synthesized stage start",
    async (state) => {
      await configureIteration("unit-major");
      const design = reviewFixture();
      const other = reviewFixture({ unit: "unit-beta", id: "b" });
      for (const fixture of [design, other]) await save(fixture);
      await audit(
        [design, other]
          .map((fixture) => fixture.request + (state === "completed" ? fixture.completion : ""))
          .join(""),
      );
      const changed = path.join(record, "audit", "stage-clone.md");
      await writeFile(changed, reviewAudit("STAGE_STARTED", { Stage: "functional-design" }, 3));
      const expected = new Map([
        [reviewCellKey("unit-alpha", "functional-design"), state === "completed" ? "READY" : null],
        [reviewCellKey("unit-beta", "functional-design"), state === "completed" ? "READY" : null],
      ]);
      expect((await readReviewVerdicts(record)).cells).toEqual(expected);
      expect(await reviewUnitsInAuditShard(record, changed)).toEqual([]);
      if (state === "pending") {
        await writeFile(
          path.join(record, "audit", "late-clone.md"),
          [design, other]
            .map((fixture) => reviewAudit("REVIEW_COMPLETED", fixture.completionFields, 4))
            .join(""),
        );
        expect(await read()).toBe("READY");
      }
    },
  );

  it("still resets stage-major reviews and notifies their units on stage start", async () => {
    const fixture = reviewFixture();
    await save(fixture);
    await audit(fixture.request + fixture.completion);
    const changed = path.join(record, "audit", "stage-clone.md");
    await writeFile(changed, reviewAudit("STAGE_STARTED", { Stage: "functional-design" }, 3));
    expect(await read()).toBeNull();
    expect(await reviewUnitsInAuditShard(record, changed)).toEqual(["unit-alpha"]);
  });

  it.each(["completed", "pending"])(
    "resets only the named Bolt units' %s reviews across all stages",
    async (state) => {
      await configureIteration("unit-major");
      const design = reviewFixture();
      const code = reviewFixture({ stage: "code-generation", id: "b" });
      const other = reviewFixture({ unit: "unit-beta", id: "c" });
      for (const fixture of [design, code, other]) await save(fixture);
      await audit(
        [design, code]
          .map((fixture) => fixture.request + (state === "completed" ? fixture.completion : ""))
          .join("") +
          other.request +
          other.completion,
      );
      const changed = path.join(record, "audit", "bolt-clone.md");
      await writeFile(
        changed,
        reviewAudit("BOLT_STARTED", { "Bolt names": " unit-alpha, unit-gamma " }, 3),
      );
      const expected = new Map([
        [reviewCellKey("unit-alpha", "functional-design"), null],
        [reviewCellKey("unit-alpha", "code-generation"), null],
        [reviewCellKey("unit-beta", "functional-design"), "READY"],
      ]);
      expect((await readReviewVerdicts(record)).cells).toEqual(expected);
      expect(await reviewUnitsInAuditShard(record, changed)).toEqual(["unit-alpha"]);

      await writeFile(
        path.join(record, "audit", "late-clone.md"),
        [design, code]
          .map((fixture) => reviewAudit("REVIEW_COMPLETED", fixture.completionFields, 4))
          .join(""),
      );
      expect((await readReviewVerdicts(record)).cells).toEqual(expected);

      const next = reviewFixture({ id: "d", attempt: "d".repeat(16), second: 5 });
      await save(next);
      await writeFile(path.join(record, "audit", "fresh-clone.md"), next.request + next.completion);
      expect(await read()).toBe("READY");
    },
  );

  it.each(["completed", "pending"])(
    "resets %s reviews for every Gate Stages entry in only the rejected unit",
    async (state) => {
      await configureIteration("unit-major");
      const design = reviewFixture();
      const code = reviewFixture({ stage: "code-generation", id: "b" });
      const otherUnit = reviewFixture({ unit: "unit-beta", id: "c" });
      const otherStage = reviewFixture({ stage: "nfr-requirements", id: "d" });
      for (const fixture of [design, code, otherUnit, otherStage]) await save(fixture);
      await audit(
        [design, code]
          .map((fixture) => fixture.request + (state === "completed" ? fixture.completion : ""))
          .join("") +
          [otherUnit, otherStage].map((fixture) => fixture.request + fixture.completion).join(""),
      );
      const changed = path.join(record, "audit", "gate-clone.md");
      await writeFile(
        changed,
        reviewAudit(
          "GATE_REJECTED",
          {
            Stage: "nfr-requirements",
            "Gate Stages": " functional-design, code-generation ",
            Unit: "unit-alpha",
          },
          3,
        ),
      );
      const expected = new Map([
        [reviewCellKey("unit-alpha", "functional-design"), null],
        [reviewCellKey("unit-alpha", "code-generation"), null],
        [reviewCellKey("unit-beta", "functional-design"), "READY"],
        [reviewCellKey("unit-alpha", "nfr-requirements"), "READY"],
      ]);
      expect((await readReviewVerdicts(record)).cells).toEqual(expected);
      expect(await reviewUnitsInAuditShard(record, changed)).toEqual(["unit-alpha"]);

      await writeFile(
        path.join(record, "audit", "late-clone.md"),
        [design, code]
          .map((fixture) => reviewAudit("REVIEW_COMPLETED", fixture.completionFields, 4))
          .join(""),
      );
      expect((await readReviewVerdicts(record)).cells).toEqual(expected);
    },
  );

  it("requests full invalidation when a reset's audit snapshot is unreadable", async () => {
    await audit(reviewAudit("BOLT_STARTED", { "Bolt names": "unit-alpha" }, 3));
    await mkdir(path.join(record, "audit", "unreadable.md"));
    expect(
      await reviewUnitsInAuditShard(record, path.join(record, "audit", "clone.md")),
    ).toBeNull();
  });

  it.each([
    ["BOLT_STARTED", "a-boundary.md"],
    ["BOLT_STARTED", "z-boundary.md"],
    ["GATE_REJECTED", "a-boundary.md"],
    ["GATE_REJECTED", "z-boundary.md"],
  ])("rejects reviews tied with %s in another shard (%s)", async (event, shard) => {
    await configureIteration("unit-major");
    const fixture = reviewFixture();
    const other = reviewFixture({ unit: "unit-beta", id: "b" });
    await save(fixture);
    await save(other);
    await audit(
      [fixture, other]
        .map((value) => value.request + reviewAudit("REVIEW_COMPLETED", value.completionFields, 1))
        .join(""),
    );
    await writeFile(
      path.join(record, "audit", shard),
      reviewAudit(event, {
        "Bolt names": "unit-alpha",
        "Gate Stages": "functional-design, code-generation",
        Unit: "unit-alpha",
      }),
    );
    expect((await readReviewVerdicts(record)).cells).toEqual(
      new Map([
        [reviewCellKey("unit-alpha", "functional-design"), null],
        [reviewCellKey("unit-beta", "functional-design"), "READY"],
      ]),
    );
  });

  it.each(["a-request.md", "z-request.md"])(
    "refuses same-time request/completion pairs across shards when the request is in %s",
    async (requestShard) => {
      const fixture = reviewFixture();
      await save(fixture);
      await writeFile(path.join(record, "audit", requestShard), fixture.request);
      await writeFile(
        path.join(record, "audit", "m-completion.md"),
        reviewAudit("REVIEW_COMPLETED", fixture.completionFields, 1),
      );
      expect(await read()).toBeNull();
    },
  );

  it("accepts a later completion from a different shard", async () => {
    const fixture = reviewFixture();
    await save(fixture);
    await writeFile(path.join(record, "audit", "z-request.md"), fixture.request);
    await writeFile(path.join(record, "audit", "a-completion.md"), fixture.completion);
    expect(await read()).toBe("READY");
  });

  it.each([true, false])(
    "uses physical row order for same-time pairs in one shard (request first: %s)",
    async (requestFirst) => {
      const fixture = reviewFixture();
      await save(fixture);
      const completion = reviewAudit("REVIEW_COMPLETED", fixture.completionFields, 1);
      await audit(requestFirst ? fixture.request + completion : completion + fixture.request);
      expect(await read()).toBe(requestFirst ? "READY" : null);
    },
  );

  it("ignores isolated workflow approvals and refuses duplicate completion fields", async () => {
    const fixture = reviewFixture();
    await save(fixture);
    await audit(
      fixture.request +
        fixture.completion.replace(
          "**Verdict**: READY",
          "**Verdict**: READY\n**Verdict**: NOT-READY",
        ),
    );
    expect(await read()).toBeNull();
    await audit(
      [fixture.request, fixture.completion]
        .map((text) => `${text}**Workflow**: single-stage:functional-design\n`)
        .join(""),
    );
    expect(await read()).toBeNull();
  });

  it.each([
    "../outside.json",
    ".aidlc-reviews/functional-design/units/unit-alpha/../../../../../outside.json",
    "C:/outside.json",
    ".aidlc-reviews\\functional-design\\units\\unit-alpha\\aaaaaaaaaaaaaaaa\\1.json",
  ])("rejects an escaping or noncanonical record path %s", async (relative) => {
    const fixture = reviewFixture();
    await writeFile(path.join(root, "outside.json"), fixture.bytes);
    await audit(
      fixture.request +
        reviewAudit(
          "REVIEW_COMPLETED",
          { ...fixture.completionFields, "Review Record": relative },
          2,
        ),
    );
    expect(await read()).toBeNull();
  });

  it("rejects a symlinked container and hardlinked record", async () => {
    const fixture = reviewFixture();
    const outside = path.join(root, "outside");
    await mkdir(outside);
    await symlink(
      outside,
      path.join(record, ".aidlc-reviews"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await save(fixture);
    await audit(fixture.request + fixture.completion);
    expect(await read()).toBeNull();
    await rm(path.join(record, ".aidlc-reviews"));
    const file = await save(fixture);
    await link(file, path.join(root, "hardlink.json"));
    expect(await read()).toBeNull();
  });
});
