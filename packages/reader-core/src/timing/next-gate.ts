import {
  type ConstructionGatePolicy,
  isLowConfidenceEstimate,
  type NextGateEstimate,
  type NextGateKind,
  type StageView,
} from "@aidlc-guide/shared-types";

/**
 * L3 — where the next human approval gate falls, and how much estimated work
 * is left before it opens. Pure: no filesystem, no clock.
 *
 * It walks the reconciled views forward from the current stage and sums their
 * {@link StageView.remainingMs} until the first stage whose completion the
 * engine presents to a human. Like `estimateRemaining`, it adds no arithmetic
 * of its own that a stage row could disagree with.
 *
 * Gate placement mirrors the engine at stage granularity, citing the engine's
 * own predicates so an engine update has one place to be checked against:
 *
 *  - Initialization stages proceed without approval; every other in-scope
 *    stage presents a gate (aidlc-orchestrate.ts `computeGate`,
 *    stage-protocol.md §1).
 *  - Construction completion gates follow aidlc-lib.ts
 *    `isAutonomousConstructionGate` and the unit-major walk in
 *    aidlc-orchestrate.ts `emitUnitMajorRunStage` ({@link placementOf}).
 *
 * The views carry no per-Unit progress: which Unit is current, how many are
 * left, whether a checkpoint was verified. A per-Unit approval is therefore
 * reported as `unit`, whose stage-level sum covers every Unit still to come.
 * Plan Approval inside Code Generation is flagged, never used as a delimiter.
 */

/** Construction stages the compiled stage graph runs `for_each: unit-of-work`. */
export const PER_UNIT_STAGES: ReadonlySet<string> = new Set([
  "functional-design",
  "nfr-requirements",
  "nfr-design",
  "infrastructure-design",
  "code-generation",
]);

/**
 * The per-Unit stage that writes workspace source (`workspace_requires`), which
 * is what makes checkpoints apply. Each Unit's Plan Approval happens here.
 */
export const SOURCE_STAGE = "code-generation";

/**
 * When this stage is out of the plan, per-Unit artifacts are stage-level and
 * the engine walks Construction stage by stage (aidlc-lib.ts
 * `usesStageLevelPerUnitArtifacts`).
 */
export const UNITS_STAGE = "units-generation";

const NO_POLICY: ConstructionGatePolicy = {
  checkpoints: false,
  unitMajor: false,
  swarm: false,
  autonomous: false,
  teamOwnership: false,
  unitEndRhythm: false,
  skeletonStanceRecorded: false,
};

/**
 * How one unfinished stage's completion reaches the human.
 *
 * - `auto`: the engine approves it without asking.
 * - `stage`: its own gate, when its work ends.
 * - `unit`: a per-Unit gate after the current Unit's work on this stage.
 * - `block`: its gate waits until every Unit has finished the per-Unit block.
 * - `unit-block`: a per-Unit approval after the current Unit's whole block.
 */
type Placement = "auto" | "stage" | "unit" | "block" | "unit-block";

interface GateContext {
  policy: ConstructionGatePolicy;
  /** aidlc-lib.ts `firstConstructionApprovalStage`: never waived by autonomy. */
  firstConstruction: string | null;
  /** Per-Unit artifacts are Unit-level (not `usesStageLevelPerUnitArtifacts`). */
  unitLevel: boolean;
  /**
   * aidlc-lib.ts `constructionCheckpointsApply`. The engine also needs a
   * non-empty Unit DAG, which the views do not show; Unit-level artifacts are
   * the closest evidence and are required where it matters.
   */
  checkpointsApply: boolean;
}

function gateContext(views: readonly StageView[], policy: ConstructionGatePolicy): GateContext {
  const inPlan = (view: StageView | undefined): boolean =>
    view !== undefined && view.execution === "EXECUTE" && view.status !== "skipped";
  const source = views.find((view) => view.stage === SOURCE_STAGE);
  return {
    policy,
    // Completed rows stay in the search: approving the first stage must not
    // make the next one "first" in turn.
    firstConstruction:
      views.find((view) => view.phase === "CONSTRUCTION" && inPlan(view))?.stage ?? null,
    // The plan action, whatever the checkbox says.
    unitLevel: views.find((view) => view.stage === UNITS_STAGE)?.execution === "EXECUTE",
    checkpointsApply: policy.checkpoints && !policy.teamOwnership && inPlan(source),
  };
}

/**
 * The engine's decision for one stage, at stage granularity.
 *
 * Unit-major iteration with Unit-level artifacts walks each Unit through the
 * per-Unit stages with their gates held back. Afterwards:
 *  - team-owned Units get their own Unit gates, per stage or at the Unit's end;
 *  - checkpoint workflows approve each Unit at a checkpoint, and the late stage
 *    gates are bookkeeping. Autonomy makes ordinary checkpoints automatic;
 *  - legacy workflows present the stage gates one by one once every Unit is
 *    done, and autonomy never waives them.
 * Outside that walk, autonomy waives Construction completion gates except the
 * first one (legacy), or when a Skeleton Stance is recorded (checkpoints).
 */
function placementOf(view: StageView, context: GateContext): Placement {
  if (view.phase === "INITIALIZATION") return "auto";
  if (view.phase !== "CONSTRUCTION") return "stage";

  const { policy } = context;
  const perUnitMajor = PER_UNIT_STAGES.has(view.stage) && policy.unitMajor;
  const unitWalk = perUnitMajor && context.unitLevel;

  if (policy.teamOwnership && unitWalk) return policy.unitEndRhythm ? "unit-block" : "unit";

  if (context.checkpointsApply) {
    if (perUnitMajor || (view.stage === SOURCE_STAGE && policy.swarm)) {
      // Without Unit-level artifacts there is no checkpoint evidence, and the
      // engine keeps each stage's own human gate.
      if (!context.unitLevel) return "stage";
      if (policy.autonomous) return "auto";
      return perUnitMajor ? "unit-block" : "unit";
    }
    return policy.autonomous && policy.skeletonStanceRecorded ? "auto" : "stage";
  }

  const humanGate: Placement = unitWalk ? "block" : "stage";
  if (!policy.autonomous || view.stage === context.firstConstruction || perUnitMajor) {
    return humanGate;
  }
  return "auto";
}

function estimate(
  kind: NextGateKind,
  stage: string | null,
  summed: readonly StageView[],
  autoApproved: readonly string[],
): NextGateEstimate {
  const parts = summed.flatMap((view) => (view.remainingMs === null ? [] : [view.remainingMs]));
  return {
    kind,
    stage,
    remainingMs:
      summed.length === 0 ? 0 : parts.length === 0 ? null : parts.reduce((a, b) => a + b, 0),
    stages: summed.map((view) => view.stage),
    autoApproved: [...autoApproved],
    planApproval: summed.some((view) => view.stage === SOURCE_STAGE),
    lowConfidence: summed.some(isLowConfidenceEstimate),
    estimateCoverage: { known: parts.length, unknown: summed.length - parts.length },
  };
}

/**
 * The next approval gate from the current stage, or from the first row when
 * no row is current (an unstarted or finished workflow, the `none` sentinel).
 *
 * A stage awaiting approval is an open gate with nothing to wait for. A stage
 * being revised after a rejection is its own next gate. A per-Unit block's
 * gate falls where the block ends, before the next stage's work.
 */
export function estimateNextGate(
  views: readonly StageView[],
  policy: ConstructionGatePolicy = NO_POLICY,
): NextGateEstimate {
  const context = gateContext(views, policy);
  const current = views.findIndex((view) => view.isCurrent);
  const summed: StageView[] = [];
  const autoApproved: string[] = [];
  let block: { placement: "block" | "unit-block"; first: string; last: string } | null = null;

  for (const view of views.slice(Math.max(0, current))) {
    if (!view.countsTowardRemaining) continue;
    if (view.status === "awaiting-approval") return estimate("open", view.stage, [], []);
    const placement = view.status === "revising" ? "stage" : placementOf(view, context);
    if (block !== null && placement !== block.placement) break;
    summed.push(view);
    if (placement === "auto") {
      autoApproved.push(view.stage);
    } else if (placement === "stage" || placement === "unit") {
      return estimate(placement, view.stage, summed, autoApproved);
    } else if (block === null) {
      block = { placement, first: view.stage, last: view.stage };
    } else {
      block.last = view.stage;
    }
  }

  if (block === null) return estimate("none", null, summed, autoApproved);
  // Legacy: the first held-back gate opens once every Unit is done. Unit
  // approvals follow the current Unit's last stage.
  return block.placement === "block"
    ? estimate("block", block.first, summed, autoApproved)
    : estimate("unit", block.last, summed, autoApproved);
}
