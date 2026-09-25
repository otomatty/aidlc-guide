import { describe, expect, it } from "vitest";
import {
  DOCS_QA_HISTORY_ANSWER_MAX,
  DOCS_QA_HISTORY_LIMIT,
  docsQaAskHistory,
} from "@/features/docs/hooks/docs-qa-history.ts";

describe("docsQaAskHistory", () => {
  it("sends only the newest completed turns", () => {
    const turns = [
      ...Array.from({ length: 10 }, (_, index) => ({
        phase: "completed",
        question: `q${index}`,
        answer: `a${index}`,
      })),
      { phase: "answering", question: "running", answer: "" },
    ];
    const history = docsQaAskHistory(turns);
    expect(history).toHaveLength(DOCS_QA_HISTORY_LIMIT);
    expect(history[0]?.question).toBe("q2");
    expect(history.at(-1)?.question).toBe("q9");
  });

  it("trims a long answer so the next question is still accepted", () => {
    const long = "x".repeat(DOCS_QA_HISTORY_ANSWER_MAX + 500);
    const [turn] = docsQaAskHistory([{ phase: "completed", question: "q", answer: long }]);
    expect(turn?.answer).toHaveLength(DOCS_QA_HISTORY_ANSWER_MAX);
  });
});
