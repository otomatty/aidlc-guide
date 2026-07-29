/**
 * Shared wire contract — reader-core produces these, all three surfaces
 * (mcp-server / dashboard-server / dashboard-ui) consume them.
 *
 * Source: construction/reader-core/functional-design/domain-entities.md.
 * This file carries the types **plus the dependency-free constants and pure
 * presenters that belong to the wire contract** (the supported State Version,
 * the artifact path formula, `formatDuration`, …). Anything with a dependency
 * — filesystem, React, a parser — still lives in its owning package; only
 * values that every surface must agree on byte-for-byte are allowed here, so
 * no surface keeps a hand-synced copy. (Charter revised from "zero runtime
 * code": `isLowConfidenceEstimate` had already established the precedent.)
 */

/**
 * The one State Version this tool parses. Version knowledge lives in
 * reader-core's `parse/` module (BR-RC-4); this constant exists so surfaces
 * can *say* "only Version N is supported" without hardcoding the number.
 */
export const SUPPORTED_STATE_VERSION = 7;

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
 *
 * The full server-side vocabulary: reader-core (first six), docs-bridge
 * (`not-found` / `undefined-term` / `config-invalid`) and api-core routing
 * (`unknown-route` / `missing-path`). Surface-side reason→wording maps are
 * typed `Record<StandardReason, string>`, so adding a reason here fails every
 * surface's compile until it has a wording — coverage is compiler-checked,
 * not reviewed.
 */
export type StandardReason =
  | "state-missing"
  | "state-unreadable"
  | "no-active-intent"
  | "outside-record"
  | "artifact-not-found"
  | "file-too-large"
  | "not-found"
  | "undefined-term"
  | "config-invalid"
  | "unknown-route"
  | "missing-path";

/** Checkbox marks of the Stage Progress section, 1:1 with G-3's six marks. */
export type StageStatus =
  | "not-started"
  | "in-progress"
  | "awaiting-approval"
  | "revising"
  | "completed"
  | "skipped";

/**
 * The statuses under which a closed timing run belongs to the *current*
 * attempt rather than to history. A closed run with any other status
 * (`not-started`, `in-progress`, `revising`, `skipped`) predates a reset the
 * current attempt hasn't repeated yet. One definition, shared by
 * reader-core's estimator and the dashboard's stage rail — the reasoning
 * (STAGE_COMPLETED fires after GATE_APPROVED) must not be maintained twice.
 */
export const CURRENT_ATTEMPT_STATUSES: ReadonlySet<StageStatus> = new Set([
  "completed",
  "awaiting-approval",
]);

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

/** Where construction artifacts live under the record — the wire path's first segment. */
export const CONSTRUCTION_DIRNAME = "construction";

/**
 * The one artifact-address formula. Record-relative, POSIX-separated — the
 * wire format, not a filesystem path. Every surface that opens or prefetches
 * a cell artifact must build the path through this function so the prefetch
 * and the viewer cannot disagree (P-AV-2).
 */
export function artifactPath(unit: string, stage: string, file: string): string {
  return `${CONSTRUCTION_DIRNAME}/${unit}/${stage}/${file}`;
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
  /**
   * Verbatim `**Workflow**` field, `null` when absent (most events carry no
   * such field — only the synthetic lifecycle pair the engine emits for an
   * isolated `--single` stage run does, as `single-stage:<slug>`). This
   * earns its place alongside the other three kept fields (BR-RC-6) because
   * `timing/derive.ts` needs it to recognise and exclude that synthetic pair
   * from the main workflow's timeline — without it, an isolated single-stage
   * run is indistinguishable from a real one.
   */
  workflow: string | null;
}

/**
 * One `STAGE_STARTED` → `STAGE_COMPLETED` run, derived from the audit log.
 * Nothing new is recorded: the audit log is already the durable record.
 */
export interface StageTiming {
  stage: string;
  /** ISO 8601, verbatim from the `STAGE_STARTED` record. */
  startedAt: string;
  /** `null` while the run is still open. */
  endedAt: string | null;
  /** `(endedAt ?? now) - startedAt`. */
  wallMs: number;
  /**
   * Idle-trimmed estimate of hands-on time: the sum of gaps between
   * consecutive audit events, each capped at IDLE_THRESHOLD_MS.
   */
  activeMs: number;
  /** Audit events inside the run. Not a confidence signal — `estimate.ts` uses `sampleCount` (run count) for that; nothing reads this field today. */
  eventCount: number;
}

/**
 * How long a stage is expected to take, and on what evidence.
 *
 * `basis` is the fallback rung that produced it: this stage's own history,
 * its phase's, the whole workspace's, or nothing at all. No surface renders
 * `basis` directly — surfaces read confidence through `isLowConfidenceEstimate`
 * instead (`RemainingEstimate.lowConfidence` aggregates the same predicate
 * across every rung; StageRail applies it per row).
 */
export interface StageEstimate {
  stage: string;
  estimateMs: number | null;
  sampleCount: number;
  basis: "stage" | "phase" | "global" | "none";
}

/**
 * A `StageEstimate` is low confidence when it didn't come from the stage's
 * own history, or came from too few runs to trust even when it did. The one
 * definition of "low confidence" in the app — `reader-core/timing/estimate.ts`
 * aggregates it into `RemainingEstimate.lowConfidence`, and the dashboard's
 * StageRail applies it per row so a fallback estimate doesn't read as a
 * measurement (Codex round 13, finding 3).
 */
export function isLowConfidenceEstimate(
  estimate: Pick<StageEstimate, "basis" | "sampleCount">,
): boolean {
  return estimate.basis !== "stage" || estimate.sampleCount < 2;
}

/**
 * One stage with the state file and the audit log already reconciled — the
 * single record every timing-aware surface consumes (issue #9).
 *
 * The two sources disagree in four documented ways: a backward jump resets a
 * stage's `status` while its pre-jump runs stay in the log; a skip emits no
 * `STAGE_COMPLETED`; the engine writes the literal `none` sentinel into
 * `Current Stage`; and `STAGE_COMPLETED` fires only *after* `GATE_APPROVED`,
 * so an `awaiting-approval` stage may still have an open run. Every rule for
 * resolving those lives in `reader-core/timing/stage-view.ts` and nowhere
 * else — before this type existed, `estimate.ts`, `StageRail`, `NowStrip`,
 * `Header` and the VS Code status bar each re-derived them, and a fix to one
 * left the same bug standing in the others (PR #4 findings R9/R15).
 *
 * Extends {@link StageEstimate}, so `isLowConfidenceEstimate(view)` reads a
 * row's confidence with no unwrapping.
 */
export interface StageView extends StageEstimate {
  phase: Phase;
  execution: StageInfo["execution"];
  /** Verbatim from the state file — the audit log never overrides it. */
  status: StageStatus;
  /** Verbatim {@link StageInfo.unparseable}, so one row needs one record. */
  unparseable?: string;
  /** This stage is `WorkflowModel.currentStage`. At most one view has it. */
  isCurrent: boolean;
  /** A run for this stage is open right now — read from the data, never from `status`. */
  running: boolean;
  /**
   * The run that belongs to the attempt in play: the open run if there is
   * one, otherwise the most recent closed run *when `status` agrees the
   * attempt actually finished* (`completed` / `awaiting-approval`). `null`
   * when the stage has never run, or when its only runs predate a backward
   * jump that reset it.
   */
  currentAttempt: StageTiming | null;
  /** Closed runs that are not {@link currentAttempt} — earlier attempts. */
  history: StageTiming[];
  /**
   * {@link currentAttempt}'s measured `activeMs` once it has closed — the
   * duration a surface may render as a *measurement* rather than a guess.
   * `null` while the attempt is still open, or when there is no attempt.
   */
  actualActiveMs: number | null;
  /**
   * Hands-on time on {@link currentAttempt}, open or closed. `null` when
   * there is no current attempt — never defaulted to 0, which would read as
   * "started, no work done" instead of "not started".
   */
  elapsedActiveMs: number | null;
  /**
   * Work left in this stage. `0` once it is finished, skipped, or out of
   * scope; `max(0, estimate - elapsed)` while a run is open; the full
   * {@link StageEstimate.estimateMs} when the attempt has not started.
   * `null` only when no estimate could be derived at all.
   */
  remainingMs: number | null;
  /**
   * This stage's {@link remainingMs} participates in
   * {@link RemainingEstimate.totalRemainingMs}. False for a stage that is
   * already finished, skipped or out of scope — those contribute nothing,
   * and counting their `0` would turn "nothing could be estimated" (`null`)
   * into a confident zero.
   */
  countsTowardRemaining: boolean;
}

/**
 * The workflow-level roll-up of {@link TimingsPayload.stageViews}. Purely a
 * sum over the views — it holds no per-stage numbers of its own, so there is
 * nothing here that can drift from what a stage row renders.
 */
export interface RemainingEstimate {
  /**
   * Hands-on work left, not a wall-clock completion time — see the spec: the
   * wall clock is set by when the human sits down, which is not predictable.
   * Sums {@link StageView.remainingMs} over the views that
   * {@link StageView.countsTowardRemaining} marks. `null` only when nothing
   * at all could be estimated.
   */
  totalRemainingMs: number | null;
  /** Any counted estimate rests on a fallback rung or on a single sample. */
  lowConfidence: boolean;
}

/** `GET /api/timings` success body. */
export interface TimingsPayload {
  /** The active record's raw runs. Reconciliation belongs to {@link stageViews}. */
  timings: StageTiming[];
  /**
   * The `WorkflowModel.currentStage` these views were reconciled against —
   * the payload's own snapshot of what "current" meant when it was built.
   *
   * Carried explicitly rather than inferred from {@link StageView.isCurrent}:
   * "no stage is current" (a finished or unstarted workflow) and "the current
   * stage names no row at all" (the `none` sentinel, a hand-edited state file)
   * both produce zero `isCurrent` views, and a freshness check has to tell
   * them apart from the stage name the workflow feed is showing right now.
   */
  currentStage: string | null;
  /** One per `WorkflowModel.stages` entry, in the same order. */
  stageViews: StageView[];
  remaining: RemainingEstimate;
}

/**
 * Is this timings payload describing the stage the workflow feed is showing?
 *
 * `workflow.currentStage` and the timings payload come from two independent
 * reads (Codex PR #4 finding 2): a change push updates the workflow instantly,
 * but a timings read can still describe the stage that was current a moment
 * ago. Any surface that pairs the two must gate on this one predicate so it
 * never renders one stage's numbers under another stage's name — and so
 * "match" is not defined twice. The dashboard applies it once in
 * `store/select-timing.ts`; the VS Code status bar, which has no store, calls
 * {@link currentStageView} below.
 *
 * This is freshness only — *which* view is current was already decided by
 * reader-core's `resolveStageViews` (issue #9), so there is no reconciliation
 * left to get wrong at a surface.
 *
 * An absent payload is never fresh. Both `null` (neither side has a current
 * stage) is a match: there is nothing to disagree about.
 */
export function timingsMatchStage(
  workflowCurrentStage: string | null,
  timings: Pick<TimingsPayload, "currentStage"> | null,
): boolean {
  return timings !== null && timings.currentStage === workflowCurrentStage;
}

/**
 * The current stage's reconciled view, or `null` when there is no current
 * stage or the payload is stale ({@link timingsMatchStage}). The one way a
 * surface should reach for "the numbers for the stage on screen".
 */
export function currentStageView(
  workflowCurrentStage: string | null,
  timings: Pick<TimingsPayload, "currentStage" | "stageViews"> | null,
): StageView | null {
  if (!timingsMatchStage(workflowCurrentStage, timings)) return null;
  return timings?.stageViews.find((view) => view.isCurrent) ?? null;
}

/**
 * The per-row counterpart of {@link currentStageMatches}: does this view still
 * describe the row being drawn?
 *
 * Which run belongs to the attempt in play depends on the stage's `status`
 * (see {@link CURRENT_ATTEMPT_STATUSES}), so a view built from a state
 * snapshot older than the one a surface is rendering can carry a measurement
 * the fresh state has since disowned — a backward jump resets a downstream
 * row to `not-started` while the in-flight timings response still reports its
 * pre-jump run as finished (Codex review on PR #15). Gate a *measurement* on
 * this; a stage's estimate does not depend on its status and stands either
 * way.
 */
export function stageViewMatches(
  stage: Pick<StageInfo, "status">,
  view: Pick<StageView, "status"> | undefined,
): boolean {
  return view !== undefined && view.status === stage.status;
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
  /**
   * Optional base URL joined with bridge-map `docPath` when a stage has no
   * `stageDocs` override. Must be `http(s)://…` when set.
   */
  docsBaseUrl: string | null;
  /**
   * Per-stage open URL for 「docs を開く」 (Confluence / Notion / GitHub / …).
   * Absolute `http(s)` URLs preferred. Empty / omitted → fall back to
   * `docsBaseUrl` + map path, then IDE file open.
   */
  stageDocs: Readonly<Record<string, string>>;
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
  /** ③ Lead agent id that runs the stage (slug; not translated). */
  agent: string;
  /** ③ Learner-facing Japanese label for {@link agent}, when available. */
  agentDisplayName: string;
  /** ④ What the human is asked for at this stage's approval gate. */
  gateRequirement: string;
  deepLink: DeepLink | null;
  /** Verbatim section slice of the linked doc; `null` when docs are absent (BR-DB-2/3). */
  excerpt: string | null;
  /** Which aidlc-workflows version the mapping was synced against (BR-DB-4). */
  sourceVersion: string;
}

/** GET /api/io-paths の value。キーは bridge-map の論理名。 */
export interface StageIoPaths {
  stage: string;
  /** 解決に使った Unit。タブ無し / 非 Construction では null。 */
  unit: string | null;
  /** 論理名 → record 相対 POSIX path。無い・曖昧なら null。 */
  inputs: Record<string, string | null>;
  outputs: Record<string, string | null>;
}

/** resolveTerm() — glossary entry (US-04). */
export interface TermDoc {
  term: string;
  definition: string;
  deepLink: DeepLink | null;
  excerpt: string | null;
  sourceVersion: string;
}

/**
 * A markdown file surfaced in a catalogue — a usage guide (`GET /api/guides`)
 * or an agent knowledge file. One shape, because both endpoints list "a file
 * and its first heading".
 */
export interface MarkdownItem {
  /** Filename, e.g. `getting-started.md`. */
  name: string;
  /** First `#` heading, or a fallback from the filename. */
  title: string;
}

/** A markdown file with its content (`GET /api/guides/:name`, `/api/agents/:id/knowledge/:name`). */
export interface MarkdownDoc extends MarkdownItem {
  markdown: string;
}

/** One knowledge file under `.claude/knowledge/<agent-id>/`. */
export type AgentKnowledgeItem = MarkdownItem;

/** resolveAgent() — agent persona + owned stages and knowledge. */
export interface AgentDoc {
  id: string;
  displayName: string;
  description: string;
  /** Persona body after YAML frontmatter. */
  markdown: string;
  /** Stage slugs where bridge-map `agent` equals {@link id}. */
  stages: string[];
  knowledge: AgentKnowledgeItem[];
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
 * `GET /api/workflow` success body — stage 1 of first paint. Deliberately
 * carries no `matrix` key (ADR-03 段階的初回描画).
 */
export interface WorkflowPayload {
  workflow: WorkflowModel;
  nextStep: NextStep;
  serverMode: ServerMode;
  warnings?: string[];
}

/** `GET /api/docs-settings` success body — the client-safe slice of {@link BridgeConfig}. */
export interface DocsSettings {
  docsBaseUrl: string | null;
  stageDocs: Readonly<Record<string, string>>;
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

/**
 * ms → `2h10m` / `45m` / `<1m` / `—`.
 *
 * `<1m` rather than `0m`: a stage that has just started has not taken zero
 * time, and "0m" reads as a broken measurement. Lives here because the
 * dashboard and the VS Code status bar must format the same
 * {@link TimingsPayload} numbers identically (the extension bundle cannot
 * import dashboard code, and a hand-mirrored copy had already drifted).
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}
