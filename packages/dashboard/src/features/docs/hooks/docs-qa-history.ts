export const DOCS_QA_HISTORY_LIMIT = 8;
/** Matches the per-answer ceiling `parseQuestion` accepts in api-core. */
export const DOCS_QA_HISTORY_ANSWER_MAX = 16000;

/** Build ask history: newest completed turns, answers trimmed to what the API accepts. */
export function docsQaAskHistory(
  turns: Array<{ phase: string; question: string; answer: string }>,
): Array<{ question: string; answer: string }> {
  return turns
    .filter((turn) => turn.phase === "completed")
    .slice(-DOCS_QA_HISTORY_LIMIT)
    .map((turn) => ({
      question: turn.question,
      answer: turn.answer.slice(0, DOCS_QA_HISTORY_ANSWER_MAX),
    }));
}
