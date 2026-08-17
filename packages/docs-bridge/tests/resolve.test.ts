import path from "node:path";
import type { BridgeConfig } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { bridgeMap, normalizeTerm, resolveStage, resolveTerm } from "../src/resolve.ts";
import { DOCS_ROOT, expectError, expectOk, REPO_ROOT } from "./paths.ts";

/** docs absent — the default posture of an unconfigured install. */
const noDocs: BridgeConfig = {
  docsRepoPath: null,
  docsBaseUrl: null,
  stageDocs: {},
  projectLinks: [],
};
/** The real repository, where every docPath in the map resolves. */
const realDocs: BridgeConfig = {
  docsRepoPath: REPO_ROOT,
  docsBaseUrl: null,
  stageDocs: {},
  projectLinks: [],
};
/** A docs root that exists but contains none of the mapped files. */
const wrongDocs: BridgeConfig = {
  docsRepoPath: DOCS_ROOT,
  docsBaseUrl: null,
  stageDocs: {},
  projectLinks: [],
};

describe("resolveStage", () => {
  it("returns the four US-03 fields plus the deep link without docs", async () => {
    const { value, warnings } = expectOk(await resolveStage(noDocs, "code-generation"));
    expect(value.slug).toBe("code-generation");
    expect(value.agent).toBe("aidlc-developer-agent");
    expect(value.agentDisplayName).toBe("開発エージェント");
    expect(value.purpose.length).toBeGreaterThan(10);
    expect(value.gateRequirement.length).toBeGreaterThan(10);
    expect(value.outputs).toContain("code-summary");
    expect(value.inputs).toContain("unit-of-work");
    expect(value.deepLink).not.toBeNull();
    expect(value.sourceVersion).toBe(bridgeMap.sourceVersion);
    // BR-DB-3: no docs is degradation, not an error, and not even a warning —
    // the excerpt was never attempted.
    expect(value.excerpt).toBeNull();
    expect(warnings).toEqual([]);
  });

  it("attaches the verbatim excerpt when docs are present", async () => {
    const { value, warnings } = expectOk(await resolveStage(realDocs, "code-generation"));
    expect(warnings).toEqual([]);
    expect(value.excerpt).not.toBeNull();
    expect(value.excerpt?.startsWith("# Code Generation")).toBe(true);
  });

  it("degrades to {ok} + warning when the mapped file is absent from the docs root", async () => {
    const { value, warnings } = expectOk(await resolveStage(wrongDocs, "code-generation"));
    expect(value.purpose.length).toBeGreaterThan(0); // the static entry still lands
    expect(value.excerpt).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/unreadable/);
  });

  it("aliases application-design to the domain-design entry (State Version 7)", async () => {
    const aliased = expectOk(await resolveStage(noDocs, "application-design"));
    const current = expectOk(await resolveStage(noDocs, "domain-design"));
    expect(aliased.value.slug).toBe("application-design");
    expect(aliased.value.purpose).toBe(current.value.purpose);
    expect(aliased.value.deepLink).toEqual(current.value.deepLink);
  });

  it("rejects an unknown slug", async () => {
    expect(expectError(await resolveStage(noDocs, "not-a-stage"))).toBe("not-found");
  });

  it("trims the slug but does not otherwise guess", async () => {
    expect(expectOk(await resolveStage(noDocs, "  units-generation  ")).value.slug).toBe(
      "units-generation",
    );
    expect(expectError(await resolveStage(noDocs, "Units-Generation"))).toBe("not-found");
  });
});

describe("resolveTerm", () => {
  it("resolves a known term case- and whitespace-insensitively", async () => {
    const { value } = expectOk(await resolveTerm(noDocs, "  Walking Skeleton "));
    expect(value.term).toBe("walking skeleton");
    expect(value.definition).toMatch(/Bolt/);
    expect(value.deepLink?.docPath).toContain("stage-protocol.md");
  });

  it("attaches the excerpt of a level-3 anchor from the real docs", async () => {
    const { value, warnings } = expectOk(await resolveTerm(realDocs, "walking skeleton"));
    expect(warnings).toEqual([]);
    expect(value.excerpt?.startsWith("### Construction Bolt gates")).toBe(true);
  });

  it("degrades to {ok} + warning when the mapped file is absent (BR-DB-3)", async () => {
    const { value, warnings } = expectOk(await resolveTerm(wrongDocs, "bolt"));
    expect(value.definition.length).toBeGreaterThan(0);
    expect(value.excerpt).toBeNull();
    expect(warnings).toHaveLength(1);
  });

  it("rejects an unknown term with its own reason", async () => {
    expect(expectError(await resolveTerm(noDocs, "flux capacitor"))).toBe("undefined-term");
  });

  it("normalizeTerm is the lookup key builder", () => {
    expect(normalizeTerm(" Unit Of Work ")).toBe("unit of work");
  });
});

describe("determinism (R-DB-3 / US-23 cross-consumer AC)", () => {
  it("returns an identical value for the same slug on repeated calls", async () => {
    const first = expectOk(await resolveStage(realDocs, "delivery-planning"));
    const second = expectOk(await resolveStage(realDocs, "delivery-planning"));
    expect(second.value).toEqual(first.value);
  });

  it("returns an identical value regardless of which consumer holds the config", async () => {
    // Two independently-constructed configs stand in for mcp-server and
    // dashboard-server: same function, same data file, therefore same answer.
    const asMcp: BridgeConfig = {
      docsRepoPath: path.resolve(REPO_ROOT),
      docsBaseUrl: null,
      stageDocs: {},
      projectLinks: [],
    };
    const asDashboard: BridgeConfig = {
      docsRepoPath: REPO_ROOT,
      docsBaseUrl: null,
      stageDocs: {},
      projectLinks: [{ label: "x", target: "y" }],
    };
    const a = expectOk(await resolveTerm(asMcp, "gate"));
    const b = expectOk(await resolveTerm(asDashboard, "GATE"));
    expect(b.value).toEqual(a.value);
  });

  it("the loaded map is frozen, so one consumer cannot mutate what another reads", () => {
    expect(Object.isFrozen(bridgeMap)).toBe(true);
  });
});
