import type { ReadResult } from "@aidlc-guide/shared-types";
import { describe, expect, it, vi } from "vitest";
import type { ToolReply } from "../src/render.ts";
import { explainStage } from "../src/tools/explain-stage.ts";
import { glossary } from "../src/tools/glossary.ts";
import { nextSteps } from "../src/tools/next-steps.ts";
import { readArtifact } from "../src/tools/read-artifact.ts";
import { status } from "../src/tools/status.ts";
import {
  expectNormalReply,
  failed,
  NEXT_STEP,
  ok,
  ROOT,
  STAGE_DOC,
  stubBridge,
  stubReader,
  TERM_DOC,
  unsupported,
  WORKFLOW,
} from "./support.ts";

/**
 * The BR-MS-3 table. Every tool is driven through every branch its dependency
 * can produce, and each one must come back as an ordinary reply — the whole
 * point of this unit's fail-soft contract is that the AI reads a reason and
 * picks another action instead of seeing a protocol error.
 */
interface ToolCase {
  name: string;
  /** Invoke the tool with the dependency stubbed to return `result`. */
  run: (result: ReadResult<never>) => Promise<ToolReply>;
  reasons: string[];
}

const CASES: ToolCase[] = [
  {
    name: "aidlc_status",
    run: (result) => status(stubReader({ getWorkflow: async () => result }), ROOT),
    reasons: ["no-active-intent", "state-missing", "state-unreadable", "internal: boom"],
  },
  {
    name: "aidlc_next_steps",
    run: (result) => nextSteps(stubReader({ getNextStep: async () => result }), ROOT),
    reasons: ["no-active-intent", "state-missing", "internal: boom"],
  },
  {
    name: "aidlc_explain_stage",
    run: (result) => explainStage(stubBridge({ resolveStage: async () => result }), ROOT, "x"),
    reasons: ["not-found", "config-invalid", "internal: boom"],
  },
  {
    name: "aidlc_glossary",
    run: (result) => glossary(stubBridge({ resolveTerm: async () => result }), ROOT, "x"),
    reasons: ["undefined-term", "config-invalid", "internal: boom"],
  },
  {
    name: "aidlc_read_artifact",
    run: (result) =>
      readArtifact(
        stubReader({ readArtifact: async () => result }),
        ROOT,
        async () => ok("/rec"),
        "a.md",
      ),
    reasons: ["artifact-not-found", "file-too-large", "outside-record", "internal: boom"],
  },
];

describe.each(CASES)("$name — every failure branch is a normal reply", ({ run, reasons }) => {
  it("unsupported state version", async () => {
    const reply = expectNormalReply(await run(unsupported("9")));
    expect(reply.degraded?.kind).toBe("unsupported");
    expect(reply.text).toContain("State Version 9");
  });

  it.each(reasons)("error reason %s", async (reason) => {
    const reply = expectNormalReply(await run(failed(reason)));
    expect(reply.degraded).toEqual({ kind: "error", detail: reason });
  });
});

describe("aidlc_status (M1)", () => {
  it("renders phase / stage / gate / progress and the JSON twin", async () => {
    const reply = expectNormalReply(
      await status(stubReader({ getWorkflow: async () => ok(WORKFLOW) }), ROOT),
    );
    expect(reply.text).toContain("フェーズ: CONSTRUCTION");
    expect(reply.text).toContain("現在のステージ: code-generation");
    expect(reply.text).toContain("ゲート: 承認待ち");
    expect(reply.text).toContain("進捗: 21 / 32 ステージ完了");
    expect(reply.data).toBe(WORKFLOW);
  });

  it("never calls getNextStep — that is M3's contract, not M1's", async () => {
    const getNextStep = vi.fn();
    await status(stubReader({ getWorkflow: async () => ok(WORKFLOW), getNextStep }), ROOT);
    expect(getNextStep).not.toHaveBeenCalled();
  });

  it("surfaces field-level degradation and warnings rather than a clean-looking answer", async () => {
    const model = { ...WORKFLOW, unparseable: { done: "Completed 行が読めません" } };
    const reply = expectNormalReply(
      await status(
        stubReader({ getWorkflow: async () => ok(model, ["監査シャード1件を無視"]) }),
        ROOT,
      ),
    );
    expect(reply.text).toContain("解析できなかった項目 — done: Completed 行が読めません");
    expect(reply.text).toContain("注意: 監査シャード1件を無視");
  });

  it("reads a workflow with no current stage without inventing one", async () => {
    const model = { ...WORKFLOW, currentStage: null, gate: null };
    const reply = expectNormalReply(
      await status(stubReader({ getWorkflow: async () => ok(model) }), ROOT),
    );
    expect(reply.text).toContain("現在のステージ: （なし — 未着手または完了）");
    expect(reply.text).toContain("ゲート: （なし）");
  });
});

describe("aidlc_next_steps (M3)", () => {
  it("names the next stage and what the human must do", async () => {
    const reply = expectNormalReply(
      await nextSteps(stubReader({ getNextStep: async () => ok(NEXT_STEP) }), ROOT),
    );
    expect(reply.text).toContain("次のステージ: build-and-test");
    expect(reply.text).toContain("人間に求められること: build-and-test: 未着手");
  });

  it("says the workflow is complete when there is no next stage", async () => {
    const done = { nextStage: null, requirement: "残りの in-scope ステージはありません" };
    const reply = expectNormalReply(
      await nextSteps(stubReader({ getNextStep: async () => ok(done) }), ROOT),
    );
    expect(reply.text).toContain("ワークフロー完了");
  });
});

describe("aidlc_explain_stage (M2)", () => {
  it("returns the five static fields plus the excerpt verbatim (BR-MS-4)", async () => {
    const reply = expectNormalReply(
      await explainStage(
        stubBridge({ resolveStage: async () => ok(STAGE_DOC) }),
        ROOT,
        "code-generation",
      ),
    );
    expect(reply.text).toContain("目的: 設計をコードに落とす段階。");
    expect(reply.text).toContain("担当エージェント: 開発エージェント（developer-agent）");
    expect(reply.text).toContain("承認ゲートで求められること: 生成コードのレビューと承認");
    expect(reply.text).toContain("docs/guide/04-construction.md#code-generation");
    // Verbatim: the excerpt appears exactly as docs-bridge sliced it.
    expect(reply.text).toContain(STAGE_DOC.excerpt as string);
  });

  it("passes the slug through to the bridge unchanged", async () => {
    const resolveStage = vi.fn(async () => ok(STAGE_DOC));
    await explainStage(stubBridge({ resolveStage }), ROOT, "user-stories");
    expect(resolveStage).toHaveBeenCalledWith("user-stories");
  });

  it("answers 該当なし for an unknown slug instead of erroring", async () => {
    const reply = expectNormalReply(
      await explainStage(
        stubBridge({ resolveStage: async () => failed("not-found") }),
        ROOT,
        "nope",
      ),
    );
    expect(reply.text).toContain("該当なし");
  });

  it("renders a doc with no deep link", async () => {
    const doc = { ...STAGE_DOC, deepLink: null, excerpt: null, inputs: [], outputs: [] };
    const reply = expectNormalReply(
      await explainStage(stubBridge({ resolveStage: async () => ok(doc) }), ROOT, "x"),
    );
    expect(reply.text).toContain("ドキュメント: （リンクなし）");
    expect(reply.text).toContain("入力: （なし）");
  });
});

describe("aidlc_glossary (M5)", () => {
  it("returns the definition verbatim", async () => {
    const reply = expectNormalReply(
      await glossary(stubBridge({ resolveTerm: async () => ok(TERM_DOC) }), ROOT, "Bolt"),
    );
    expect(reply.text).toContain("定義: 垂直に切られた出荷可能な作業の単位。");
    expect(reply.data).toBe(TERM_DOC);
  });

  it("includes the excerpt when docs are present", async () => {
    const doc = { ...TERM_DOC, excerpt: "# Bolt\n原文。" };
    const reply = expectNormalReply(
      await glossary(stubBridge({ resolveTerm: async () => ok(doc) }), ROOT, "Bolt"),
    );
    expect(reply.text).toContain("# Bolt\n原文。");
  });

  it("answers 未定義 for an unknown term", async () => {
    const reply = expectNormalReply(
      await glossary(stubBridge({ resolveTerm: async () => failed("undefined-term") }), ROOT, "zz"),
    );
    expect(reply.text).toContain("未定義");
  });
});

describe("aidlc_read_artifact (M4)", () => {
  it("returns the body verbatim, with no JSON twin to double the payload", async () => {
    const body = "# Requirements\nFR-1 ...";
    const reply = expectNormalReply(
      await readArtifact(
        stubReader({ readArtifact: async () => ok(body) }),
        ROOT,
        async () => ok(process.cwd()),
        "inception/requirements.md",
      ),
    );
    expect(reply.text).toBe(body);
    expect(reply.data).toBeUndefined();
  });

  it("reports no-active-intent without ever reaching the reader", async () => {
    const read = vi.fn();
    const reply = expectNormalReply(
      await readArtifact(
        stubReader({ readArtifact: read }),
        ROOT,
        async () => failed("no-active-intent"),
        "a.md",
      ),
    );
    expect(read).not.toHaveBeenCalled();
    expect(reply.text).toContain("アクティブなインテントがありません");
  });
});
