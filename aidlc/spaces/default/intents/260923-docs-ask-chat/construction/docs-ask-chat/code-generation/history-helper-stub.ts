// staging stub — history helper only
import { docsQaAskHistory } from "@/features/docs/hooks/docs-qa-history.ts";

export function buildAskHistory(
  turns: Array<{ phase: string; question: string; answer: string }>,
) {
  return docsQaAskHistory(turns);
}
