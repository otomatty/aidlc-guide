import { parseState } from "../parse/state.ts";

/**
 * The stage-graph order a STAGE_JUMPED row is judged against. The engine reads
 * its compiled stage graph (aidlc-workflows v2.11.0 aidlc-lib.ts `stageIndex`);
 * the record's own Stage Progress section is written from that same graph and
 * lists every stage in graph order, so it is read here instead of choosing
 * between the stage graphs of several installed harnesses. A state file this
 * reader does not support, or one without Stage Progress rows, gives no order,
 * which upstream treats as a graph that cannot be read.
 */
export function stageOrderOf(stateText: string | null): readonly string[] | null {
  if (stateText === null) return null;
  const parsed = parseState(stateText);
  if (!("ok" in parsed)) return null;
  const order = parsed.value.stages.map((stage) => stage.slug);
  return order.length > 0 ? order : null;
}

/**
 * aidlc-workflows v2.11.0 aidlc-lib.ts `stageJumpReaches`: a jump resets its
 * Target and every stage after it in the stage graph, so a stage before the
 * Target keeps its attempt. A row with no Target, a Target or stage the graph
 * does not know, or an unknown graph reaches every stage.
 */
export function stageJumpReaches(
  target: string | undefined,
  slug: string,
  order: readonly string[] | null,
): boolean {
  if (!target || target === slug || order === null) return true;
  const targetAt = order.indexOf(target);
  const at = order.indexOf(slug);
  return targetAt === -1 || at === -1 || at >= targetAt;
}
