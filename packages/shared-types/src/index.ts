/**
 * Shared type contract — reader-core produces these, all three surfaces
 * (mcp-server / dashboard-server / dashboard-ui) consume them.
 *
 * Source: construction/reader-core/functional-design/domain-entities.md.
 * This file contains **zero runtime code** (tech-stack-decisions.md): types
 * only, so nothing here ships in a build artifact.
 */

/**
 * Every public read boundary returns this — reader-core never throws
 * (BR-RC-2 / R-RC-1).
 *
 * - `ok`        — usable value. `warnings` carries element-level degradation
 *                 that did not invalidate the snapshot (BR-RC-5).
 * - `unsupported` — State Version is not 7; refusing to guess is safer than
 *                 mis-reading (G-2 / C-T3).
 * - `error`     — entry-level failure. `reason` is normally a
 *                 {@link StandardReason}; unexpected internal faults are
 *                 normalised to `"internal: <message>"`.
 */
export type ReadResult<T> =
  | { ok: true; value: T; warnings?: string[] }
  | { unsupported: true; version: string }
  | { error: true; reason: string };

/**
 * Error reasons consumers are allowed to branch UI on. Changing one of these
 * strings is a breaking change (domain-entities.md "標準エラー reason 値").
 */
export type StandardReason =
  | "state-missing"
  | "state-unreadable"
  | "no-active-intent"
  | "outside-record"
  | "artifact-not-found"
  | "file-too-large";

/** Checkbox marks of the Stage Progress section, 1:1 with G-3's six marks. */
export type StageStatus =
  | "not-started"
  | "in-progress"
  | "awaiting-approval"
  | "revising"
  | "completed"
  | "skipped";

export type Phase = "INITIALIZATION" | "IDEATION" | "INCEPTION" | "CONSTRUCTION" | "OPERATION";

export type Verdict = "READY" | "NOT-READY";

export interface StageInfo {
  slug: string;
  phase: Phase;
  execution: "EXECUTE" | "SKIP";
  status: StageStatus;
  /** Line-level degradation, e.g. an unknown G-3 mark. */
  unparseable?: string;
}

export interface WorkflowModel {
  project: string;
  scope: string;
  depth: string;
  stateVersion: 7;
  /** Current Status → Lifecycle Phase. */
  phase: Phase;
  currentStage: string | null;
  /** Current Status → Next Stage (the state file's own claim). */
  nextStage: string | null;
  /** Status of {@link currentStage}; `awaiting-approval` means a gate is open. */
  gate: StageStatus | null;
  stages: StageInfo[];
  /** G-5: `Completed` field first, `[x]`+`[S]` tally as fallback. */
  done: number;
  /** G-6: `Total Stages` field first, EXECUTE-row count as fallback. */
  total: number;
  /** Field-level degradation, keyed by {@link WorkflowModel} field name. */
  unparseable?: Record<string, string>;
}

/** getNextStep() — data source of the NextStepCallout (FR-2.3 / US-02). */
export interface NextStep {
  /** `null` = no further in-scope stage (workflow complete). */
  nextStage: string | null;
  /** What the human is asked for at that stage. */
  requirement: string;
}

export interface MatrixCell {
  unit: string;
  stage: string;
  /**
   * The `*.md` artifacts in `<unit>/<stage>/`, filenames only, sorted
   * (R-RC-5). Carries the count *and* names the files: the matrix shows
   * `files.length`, the artifact viewer opens `construction/<unit>/<stage>/
   * <files[i]>` — no second endpoint to enumerate a cell.
   */
  files: string[];
  verdict: Verdict | null;
  /** Cell-level degradation (failure mode 4); other cells stay valid. */
  error?: string;
}

export interface Matrix {
  units: string[];
  stages: string[];
  cells: MatrixCell[];
}

export interface AuditEvent {
  /** Taxonomy name from the `**Event**` field. */
  event: string;
  stage: string | null;
  /** ISO 8601, verbatim from the `**Timestamp**` field. */
  timestamp: string;
  /** Originating shard filename — kept for provenance, not content. */
  shard: string;
}

export interface IntentList {
  space: string;
  /** Failure mode 1: `null` when the cursor is absent, empty or dangling. */
  active: string | null;
  /** Failure mode 2: always enumerated, independent of the cursor. */
  all: string[];
}

/** watch() notification — a scope of the record changed. */
export interface ChangeEvent {
  type: "change";
  scope: "state" | `matrix:${string}` | "audit";
  path: string;
}

/** watch() notification — liveness lost, the UI must stop trusting freshness (R-RC-4). */
export interface WatchWarning {
  type: "watch-warning";
  reason: "watcher-lost" | "resubscribe-failed";
}

/** Discriminated union handed to the watch callback. */
export type WatchEvent = ChangeEvent | WatchWarning;

/* ------------------------------------------------------------------ *
 * docs-bridge (U2) — source: construction/docs-bridge/functional-design/
 * domain-entities.md. Same ReadResult contract as reader-core.
 * ------------------------------------------------------------------ */

/** A project-specific link surfaced next to the built-in docs (FR-5.3). */
export interface ProjectLink {
  label: string;
  /** Relative path or URL — one field for both (component-methods.md `Link[]`). */
  target: string;
}

/** `aidlc-guide.config.json`, after loading and validation (D1). */
export interface BridgeConfig {
  /** Absolute path to the docs checkout. `null` = run without excerpts. */
  docsRepoPath: string | null;
  projectLinks: ProjectLink[];
}

/** Where an entry points into the docs tree; `null` when the entry has no target. */
export interface DeepLink {
  docPath: string;
  docAnchor: string;
}

/** resolveStage() — data source of the StageCard explanation (US-03). */
export interface StageDoc {
  slug: string;
  /** ① What this stage is for, in 1–2 plain sentences. */
  purpose: string;
  /** ② Artifacts the stage consumes. */
  inputs: string[];
  /** ② Artifacts the stage produces. */
  outputs: string[];
  /** ③ Lead agent that runs the stage. */
  agent: string;
  /** ④ What the human is asked for at this stage's approval gate. */
  gateRequirement: string;
  deepLink: DeepLink | null;
  /** Verbatim section slice of the linked doc; `null` when docs are absent (BR-DB-2/3). */
  excerpt: string | null;
  /** Which aidlc-workflows version the mapping was synced against (BR-DB-4). */
  sourceVersion: string;
}

/** resolveTerm() — glossary entry (US-04). */
export interface TermDoc {
  term: string;
  definition: string;
  deepLink: DeepLink | null;
  excerpt: string | null;
  sourceVersion: string;
}

/* ------------------------------------------------------------------ *
 * dashboard-server (U5) — source: construction/dashboard-server/
 * functional-design/domain-entities.md. Shared because the WS union and
 * the answer contract are the wire format the dashboard-ui speaks.
 * ------------------------------------------------------------------ */

/** CLI-level serve contract (`--port` / `--host`). */
export interface ServeOptions {
  port: number;
  /**
   * `--host`: LAN bind + read-only mode + startup exposure warning (S-DS-1).
   * Decided once at process start; `readonly` because there is no toggle and
   * no env/config path that can flip it later (S-MM-6 / BR-MM-1).
   */
  readonly host: boolean;
}

/**
 * Returned by `GET /api/workflow` so the client can drop the editing UI from
 * the DOM in host mode. Advisory only — the server's 403 is the real gate
 * (US-11 二重防御).
 */
export interface ServerMode {
  readonly hostMode: boolean;
}

/**
 * Server → client push. The server never reads from the socket (S-DS-6), so
 * this union is one-way.
 *
 * Clients get no snapshot on connect: initial state comes from REST, the
 * socket carries only deltas (domain-entities.md ライフサイクル).
 */
export type WsMessage =
  | { type: "matrix-ready"; matrix: Matrix }
  | { type: "change"; scope: "state"; workflow: WorkflowModel; nextStep: NextStep }
  | { type: "change"; scope: `matrix:${string}`; cells: MatrixCell[] }
  | { type: "change"; scope: "audit"; events: AuditEvent[] }
  | { type: "live-status"; degraded: boolean; reason?: string };

/**
 * `POST /api/answer` body — the system's only write.
 *
 * `line` is **1-based**, matching how the artifact is displayed to the human
 * who is answering (see code-summary.md D-3).
 */
export interface AnswerRequest {
  file: string;
  line: number;
  value: string;
}

/** The five AnswerWriter gate rejections (business-rules.md エラー識別子). */
export type AnswerError =
  | "read-only-mode"
  | "not-a-questions-file"
  | "outside-record"
  | "not-an-answer-line"
  | "write-verification-failed";
