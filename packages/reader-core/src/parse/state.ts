import path from "node:path";
import { readBounded } from "@aidlc-guide/core-utils";
import {
  CURRENT_STATE_VERSION,
  isSupportedStateVersion,
  LEGACY_STATE_WARNING,
  type Phase,
  type ReadResult,
  type StageInfo,
  type StageStatus,
  SUPPORTED_STATE_VERSION,
  schemaCompatibilityOf,
  type WorkflowModel,
} from "@aidlc-guide/shared-types";

/**
 * L1 — the **only** module that knows the State Version file format
 * (BR-RC-4). If the engine ever moves state to YAML/JSON, this file is the one
 * that gets replaced.
 *
 * Grammar rules G-1..G-6 live in
 * `construction/reader-core/functional-design/business-rules.md`.
 */

export { CURRENT_STATE_VERSION, SUPPORTED_STATE_VERSION };
export const STATE_FILENAME = "aidlc-state.md";

/** G-1: `## <heading>` opens a section. */
const SECTION_RE = /^##\s+(.+?)\s*$/;
/** G-4: `### <PHASE> PHASE` opens a phase block inside Stage Progress. */
const PHASE_RE = /^###\s+(.+?)\s+PHASE\s*$/;
/** G-1: `- **<name>**: <value>` is a field. */
const FIELD_RE = /^-\s+\*\*(.+?)\*\*:\s*(.*)$/;
/** G-3: `- [<mark>] <slug> — <EXECUTE|SKIP>` is a stage row. */
const STAGE_RE = /^-\s+\[(.)\]\s+(.+?)\s+—\s+(\S+)\s*$/;

/** G-3: the six marks, 1:1 with StageStatus. */
const MARKS: Record<string, StageStatus> = {
  " ": "not-started",
  "-": "in-progress",
  "?": "awaiting-approval",
  R: "revising",
  x: "completed",
  S: "skipped",
};

const PHASES: readonly Phase[] = [
  "INITIALIZATION",
  "IDEATION",
  "INCEPTION",
  "CONSTRUCTION",
  "OPERATION",
];

function toPhase(raw: string): Phase | null {
  return (PHASES as readonly string[]).includes(raw) ? (raw as Phase) : null;
}

interface Doc {
  /** section name → field name → value */
  fields: Map<string, Map<string, string>>;
  stages: StageInfo[];
}

/** G-1/G-3/G-4: single forward pass, line-oriented, no backtracking (S-RC-4). */
function scan(text: string): Doc {
  const fields = new Map<string, Map<string, string>>();
  const stages: StageInfo[] = [];
  let section: string | null = null;
  let phase: Phase | null = null;

  for (const line of text.split(/\r?\n/)) {
    const section_ = SECTION_RE.exec(line);
    if (section_?.[1] !== undefined) {
      section = section_[1];
      phase = null;
      continue;
    }

    const phase_ = PHASE_RE.exec(line);
    if (phase_?.[1] !== undefined) {
      // G-4: an unknown phase heading suppresses its rows rather than
      // inventing a phase for them.
      phase = toPhase(phase_[1]);
      continue;
    }

    const field = FIELD_RE.exec(line);
    if (field?.[1] !== undefined && section !== null) {
      const bucket = fields.get(section) ?? new Map<string, string>();
      bucket.set(field[1], field[2] ?? "");
      fields.set(section, bucket);
      continue;
    }

    if (section !== "Stage Progress" || phase === null) continue;
    const stage = STAGE_RE.exec(line);
    const mark = stage?.[1];
    const slug = stage?.[2];
    const execution = stage?.[3];
    if (mark === undefined || slug === undefined || execution === undefined) continue;

    const marked = MARKS[mark];
    const known = execution === "EXECUTE" || execution === "SKIP";
    const notes: string[] = [];
    if (marked === undefined) notes.push(`unknown-mark: ${JSON.stringify(mark)}`);
    if (!known) notes.push(`unknown-execution: ${execution}`);

    // An unreadable execution column must not inflate the EXECUTE tally that
    // G-6 falls back to, so it degrades to SKIP.
    const scope = execution === "EXECUTE" ? "EXECUTE" : "SKIP";
    const status = marked ?? "not-started";

    stages.push({
      slug,
      phase,
      execution: scope,
      // G-3: the engine leaves out-of-scope rows unticked (`[ ] … — SKIP`) and
      // reserves `[S]` for an in-scope stage jumped over. Both are skipped —
      // an out-of-scope stage is not merely "not started yet". Keyed on the
      // literal token and the parsed mark, never on their fallbacks: those two
      // degradations exist to keep an unreadable row countable, and neither is
      // evidence of what the row actually says.
      status: execution === "SKIP" && marked === "not-started" ? "skipped" : status,
      ...(notes.length > 0 ? { unparseable: notes.join("; ") } : {}),
    });
  }

  return { fields, stages };
}

function field(doc: Doc, section: string, name: string): string | undefined {
  const value = doc.fields.get(section)?.get(name);
  return value === undefined || value === "" ? undefined : value;
}

function integer(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * `aidlc-state.ts` writes the literal string `"none"` into `Current Stage`,
 * `Next Stage` (and `In Progress`, unread here) as its "nothing here"
 * sentinel — both when a workflow finishes (`finalize()`, ~line 1513-1516:
 * `Current Stage: none` / `Next Stage: none` alongside `Status: Completed`)
 * and mid-run whenever there is no next stage to name (~line 1371/1502/2162).
 * No stage definition is ever slugged `"none"`, so the literal can never be
 * a real in-scope stage — treat it exactly like an absent field (Codex PR #4
 * finding 1). Without this, `"none"` round-trips as a stage slug that
 * doesn't exist in `doc.stages`, and `timing/estimate.ts` reads a
 * non-existent "current stage" as an unstarted one, billing it the
 * workspace-wide median as phantom remaining work on an already-finished
 * workflow. Do not "fix" this back to passing the literal through — the
 * sentinel is the engine's, not a legitimate slug.
 */
function normalizeNoneSentinel(value: string | undefined): string | undefined {
  return value === "none" ? undefined : value;
}

/**
 * Pure parser over the file body — the FS-free half of L1, so every G-rule
 * branch is reachable from a unit test (R-RC-2 branch coverage).
 */
export function parseState(text: string): ReadResult<WorkflowModel> {
  // The section split runs first because G-2's version field is section-scoped
  // (it only counts inside `## Project Information`) — locating it needs the
  // document model. The scan is a single linear pass with no interpretation:
  // nothing is derived from an unsupported file, the model is discarded at the
  // gate below.
  const doc = scan(text);

  // G-2: version gate. Unregistered versions are refused outright — no field
  // of an unknown format is ever interpreted.
  const rawVersion = field(doc, "Project Information", "State Version");
  const version =
    rawVersion !== undefined && /^\d+$/.test(rawVersion) ? Number(rawVersion) : undefined;
  if (version === undefined || !isSupportedStateVersion(version)) {
    return { unsupported: true, version: rawVersion ?? "unknown" };
  }

  const unparseable: Record<string, string> = {};
  const warnings: string[] = [];
  if (schemaCompatibilityOf(version) === "legacy") warnings.push(LEGACY_STATE_WARNING);

  const required = (key: keyof WorkflowModel, section: string, name: string): string => {
    const value = field(doc, section, name);
    if (value === undefined) unparseable[key] = `missing field: ${section} → ${name}`;
    return value ?? "";
  };

  const project = required("project", "Project Information", "Project");
  const scope = required("scope", "Project Information", "Scope");
  const depth = required("depth", "Scope Configuration", "Depth");

  const rawPhase = field(doc, "Current Status", "Lifecycle Phase");
  const phase = rawPhase === undefined ? null : toPhase(rawPhase);
  if (phase === null) {
    unparseable.phase = rawPhase === undefined ? "missing field" : `unknown phase: ${rawPhase}`;
  }

  // G-5: field first, [x]+[S] tally as fallback. Scoped to EXECUTE rows so the
  // fallback shares G-6's denominator — out-of-scope rows are skipped by
  // definition and would otherwise push done past total.
  const doneField = integer(field(doc, "Execution Plan Summary", "Completed"));
  const doneTally = doc.stages.filter(
    (s) => s.execution === "EXECUTE" && (s.status === "completed" || s.status === "skipped"),
  ).length;

  // G-6: field first, EXECUTE-row count as fallback. On disagreement the field
  // wins and the mismatch is surfaced — state is the engine's property, the
  // reader reports rather than adjudicates.
  const totalField = integer(field(doc, "Execution Plan Summary", "Total Stages"));
  const totalTally = doc.stages.filter((s) => s.execution === "EXECUTE").length;
  if (totalField !== undefined && totalField !== totalTally) {
    warnings.push(
      `Total Stages field (${totalField}) disagrees with the EXECUTE row count (${totalTally})`,
    );
  }

  const currentStage = normalizeNoneSentinel(field(doc, "Current Status", "Current Stage")) ?? null;
  const model: WorkflowModel = {
    project,
    scope,
    depth,
    stateVersion: version,
    schemaCompatibility: schemaCompatibilityOf(version),
    // `phase` stays typed as Phase; consumers must consult `unparseable.phase`
    // before trusting it (BR-RC-5 field-level degradation).
    phase: phase ?? "INITIALIZATION",
    currentStage,
    nextStage: normalizeNoneSentinel(field(doc, "Current Status", "Next Stage")) ?? null,
    gate: doc.stages.find((s) => s.slug === currentStage)?.status ?? null,
    stages: doc.stages,
    done: doneField ?? doneTally,
    total: totalField ?? totalTally,
    ...(Object.keys(unparseable).length > 0 ? { unparseable } : {}),
  };

  return warnings.length > 0 ? { ok: true, value: model, warnings } : { ok: true, value: model };
}

/** L1 entry point: bounded read (S-RC-4) then {@link parseState}. */
export async function readState(recordDir: string): Promise<ReadResult<WorkflowModel>> {
  const read = await readBounded(path.join(recordDir, STATE_FILENAME));
  if (!read.ok) {
    if (read.reason === "not-found") return { error: true, reason: "state-missing" };
    if (read.reason === "file-too-large") return { error: true, reason: "file-too-large" };
    return { error: true, reason: "state-unreadable" };
  }
  return parseState(read.value);
}
