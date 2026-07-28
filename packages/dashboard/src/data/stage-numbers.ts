import stageGraph from "../../../../.claude/tools/data/stage-graph.json";

/**
 * slug → stage number, derived at build time from the engine's own compiled
 * stage graph — the same file the workflow runs on, so this can never drift
 * from it. (This used to be a hand-maintained 32-row copy with a "keep in
 * sync" comment.) The tool never *writes* that file; importing it is a read.
 */
export const STAGE_NUMBERS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(stageGraph.map((stage) => [stage.slug, stage.number])),
);

/** `1.1 intent-capture` — falls back to the slug alone when unknown. */
export function formatStageLabel(slug: string): string {
  const number = STAGE_NUMBERS[slug];
  return number === undefined ? slug : `${number} ${slug}`;
}
