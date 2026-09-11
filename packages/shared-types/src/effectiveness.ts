/** Read-only observations. Counts describe recorded events, never causal improvement. */
export interface EffectivenessPayload {
  space: string;
  generatedAt: string;
  intents: IntentEffectiveness[];
  warnings: string[];
}

export interface EffectivenessUsage {
  source: "claude-ledger" | "audit-workflow" | "audit-stages" | "audit-clones";
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Configured list-rate estimate, not an invoice. null means unpriceable. */
  estimatedUsd: number | null;
  partial: boolean;
  unknownModels: string[];
}

export interface EffectivenessApprovalWait {
  /** Union of measured closed intervals; null without a valid pair, including excluded-only rows. */
  completedMs: number | null;
  /** Union of measured open intervals; null when no trustworthy open interval exists. */
  pendingMs: number | null;
  completedIntervals: number;
  pendingIntervals: number;
  /** Excluded recovered openings, missing pairs or ambiguous ordering. */
  excludedIntervals: number;
}

export interface EffectivenessReviews {
  completed: number;
  ready: number;
  notReady: number;
  firstPassReady: number;
  firstPassTotal: number;
  /** 0..1; null when no paired first review exists. */
  firstPassRate: number | null;
  unmatched: number;
}

export interface EffectivenessSensors {
  /** Checks recorded for the intent, including isolated stage writes; never main-run attribution. */
  scope: "intent-record";
  verifiedPassed: number;
  failed: number;
  skipped: number;
  incomplete: number;
  findings: number;
}

export interface IntentEffectiveness {
  dirName: string;
  id: string | null;
  name: string;
  scope: string | null;
  depth: string | null;
  status: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** Completion lead time; null without a valid start/completion pair. */
  completionMs: number | null;
  /** Start to completion or generatedAt, including pauses and approvals. */
  elapsedMs: number | null;
  /** null when state parsing prevents a supported audit interpretation. */
  auditEventCount: number | null;
  approvalWait: EffectivenessApprovalWait | null;
  rejections: number | null;
  revisions: number | null;
  /** Explicitly workflow-attributed inputs only; legacy unassigned inputs are excluded. */
  humanTurns: number | null;
  reviews: EffectivenessReviews | null;
  sensors: EffectivenessSensors | null;
  usage: EffectivenessUsage | null;
  /** Unknown or partial evidence is never presented as a measured zero. */
  warnings: string[];
}
