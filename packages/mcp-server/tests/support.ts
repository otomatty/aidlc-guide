import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Bridge } from "@aidlc-guide/docs-bridge";
import type { Reader } from "@aidlc-guide/reader-core";
import type {
  NextStep,
  ReadResult,
  StageDoc,
  TermDoc,
  WorkflowModel,
} from "@aidlc-guide/shared-types";
import { expect } from "vitest";
import { type ToolReply, toContent } from "../src/render.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(here, "..", "..", "..");
export const CLI = path.join(here, "..", "src", "index.ts");

/** Same pin as `.github/workflows/check.yml` for clones without active-intent. */
export function liveActiveIntent(): string {
  return process.env.AIDLC_ACTIVE_INTENT?.trim() || "260730-docs-i18n";
}

/** An absolute root that is never touched — the stubs stand in for all I/O. */
export const ROOT = path.resolve(path.sep === "\\" ? "C:\\ws\\aidlc-guide" : "/ws/aidlc-guide");

const NOT_CALLED = (name: string) => () => {
  throw new Error(`${name} must not be called by this tool`);
};

export function stubReader(overrides: Partial<Reader> = {}): Reader {
  return {
    getWorkflow: NOT_CALLED("getWorkflow"),
    getMatrix: NOT_CALLED("getMatrix"),
    getAuditEvents: NOT_CALLED("getAuditEvents"),
    getIntents: NOT_CALLED("getIntents"),
    getNextStep: NOT_CALLED("getNextStep"),
    getTimings: NOT_CALLED("getTimings"),
    readArtifact: NOT_CALLED("readArtifact"),
    watch: NOT_CALLED("watch"),
    ...overrides,
  } as Reader;
}

export function stubBridge(overrides: Partial<Bridge> = {}): Bridge {
  return {
    getConfig: NOT_CALLED("getConfig"),
    resolveStage: NOT_CALLED("resolveStage"),
    resolveTerm: NOT_CALLED("resolveTerm"),
    projectLinks: NOT_CALLED("projectLinks"),
    ...overrides,
  } as Bridge;
}

/** Shorthands for the three `ReadResult` branches. */
export const ok = <T>(value: T, warnings?: string[]): ReadResult<T> => ({
  ok: true,
  value,
  ...(warnings === undefined ? {} : { warnings }),
});
export const unsupported = (version: string): ReadResult<never> => ({ unsupported: true, version });
export const failed = (reason: string): ReadResult<never> => ({ error: true, reason });

/**
 * BR-MS-3: whatever the branch, the reply must leave as an ORDINARY MCP
 * response — never `isError`, never an empty body the AI cannot act on.
 */
export function expectNormalReply(reply: ToolReply): ToolReply {
  const result = toContent(reply);
  expect(result).not.toHaveProperty("isError");
  expect(result.content[0]?.type).toBe("text");
  expect(reply.text.length).toBeGreaterThan(0);
  return reply;
}

export const WORKFLOW: WorkflowModel = {
  project: "AIDLC Guide",
  scope: "mvp",
  depth: "practical",
  stateVersion: 8,
  schemaCompatibility: "current",
  phase: "CONSTRUCTION",
  currentStage: "code-generation",
  nextStage: "build-and-test",
  gate: "awaiting-approval",
  stages: [],
  done: 21,
  total: 33,
};

export const NEXT_STEP: NextStep = {
  nextStage: "build-and-test",
  requirement: "build-and-test: 未着手 — 実行を開始してください",
};

export const STAGE_DOC: StageDoc = {
  slug: "code-generation",
  purpose: "設計をコードに落とす段階。",
  inputs: ["functional-design", "nfr-design"],
  outputs: ["code-generation-plan.md", "code-summary.md"],
  agent: "developer-agent",
  agentDisplayName: "開発エージェント",
  gateRequirement: "生成コードのレビューと承認",
  deepLink: { docPath: "docs/guide/04-construction.md", docAnchor: "code-generation" },
  excerpt: "# Code Generation\n原文のまま。",
  artifactDocs: {},
  sourceVersion: "0.9.0",
};

export const TERM_DOC: TermDoc = {
  term: "Bolt",
  definition: "垂直に切られた出荷可能な作業の単位。",
  deepLink: null,
  excerpt: null,
  sourceVersion: "0.9.0",
};
