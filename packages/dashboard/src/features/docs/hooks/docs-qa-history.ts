export const DOCS_QA_HISTORY_LIMIT = 8;

/** Build ask history: newest completed turns, uncapped answers. */
export function docsQaAskHistory(
  turns: Array<{ phase: string; question: string; answer: string }>,
): Array<{ question: string; answer: string }> {
  return turns
    .filter((turn) => turn.phase === "completed")
    .slice(-DOCS_QA_HISTORY_LIMIT)
    .map((turn) => ({ question: turn.question, answer: turn.answer }));
}
