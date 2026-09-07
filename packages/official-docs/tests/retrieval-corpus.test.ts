import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDocsLibrary, serializeDocsReply } from "../src/retrieval.ts";
import { estimateTokens } from "../src/retrieval-markdown.ts";

/** Acceptance questions exercise the shipped corpus, not a replica of ranking code. */
export const RETRIEVAL_QUESTIONS: [string, RegExp][] = [
  ["AI-DLCとは何ですか", /guide\/00-introduction/],
  ["承認ゲートでセンサーが失敗した場合", /sensor/],
  ["/aidlc --resume", /cli-commands|session-management/],
  ["スコープと深さ", /scopes|depth/],
  ["Boltとは", /glossary|scopes|construction/],
  ["Unit of Work", /glossary|construction|inception/],
  ["ドキュメント knowledge rebind", /knowledge|cli-commands|hooks-and-tools/],
  ["org team project rules inheritance", /rule-system|rules-and/],
  ["code-generation outputs", /04-stages\/construction|artifacts-reference/],
  ["Swarm parallel construction", /construction-and-swarm|construction|interaction-modes/],
  ["Cursor hooks", /harnesses\/cursor|hooks-and-tools/],
  ["Claude Code skills", /skill-system|skills|claude-features/],
  ["audit logs", /state-and-audit|state-machine|hooks-and-tools/],
  ["add a new agent", /adding-an-agent|agent-system/],
  ["add a new stage", /adding-a-stage|stage-definition|stage-protocol/],
  ["/aidlc --doctor", /cli-commands|troubleshooting/],
  ["workflow profiles", /workflow-profiles/],
  ["test strategy", /scopes-and-depth|testing|cli-commands/],
  ["スペースとインテント", /spaces-and-intents|architecture|cli-commands/],
  ["knowledge documents documentkb", /knowledge|cli-commands|hooks-and-tools/],
];

const root = path.resolve(import.meta.dirname, "../../..");
const library = createDocsLibrary(root);

describe("bundled documentation acceptance questions", () => {
  it.each(RETRIEVAL_QUESTIONS)("finds a source for %s", async (query, expected) => {
    const result = await library.search({ query });
    if ("error" in result) throw new Error(result.reason);
    expect(
      result.results.some((hit) => expected.test(hit.path)),
      JSON.stringify(result.results.map((h) => `${h.path} > ${h.headings.at(-1)}`)),
    ).toBe(true);
    expect(estimateTokens(serializeDocsReply(result))).toBeLessThanOrEqual(800);
    const hit = result.results.find((h) => expected.test(h.path));
    const read = await library.read({ id: hit?.id ?? "" });
    if ("error" in read) throw new Error(read.reason);
    expect(read.source.url).not.toBe("");
    expect(read.source.version).toBe(result.sourceVersion);
    expect(estimateTokens(serializeDocsReply(read))).toBeLessThanOrEqual(1600);
  });
});
