import type { DocsQaCitation } from "@aidlc-guide/shared-types";
import type { ExtensionContext } from "vscode";

/** Persist docs Q&A conversation (turns + draft) in the extension host via globalState. */
export const DOCS_CONVERSATION_KEY = "aidlcGuide.docsConversation";

export interface DocsConversationTurn {
  id: string;
  question: string;
  answer: string;
  citations: DocsQaCitation[];
}

export interface DocsConversationState {
  turns: DocsConversationTurn[];
  draft: string;
}

const EMPTY: DocsConversationState = { turns: [], draft: "" };

function isCitation(value: unknown): value is DocsQaCitation {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.sourceId === "string";
}

function isTurn(value: unknown): value is DocsConversationTurn {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.question === "string" &&
    typeof row.answer === "string" &&
    Array.isArray(row.citations) &&
    row.citations.every(isCitation)
  );
}

function parseState(value: unknown): DocsConversationState {
  if (typeof value !== "object" || value === null) return EMPTY;
  const row = value as Record<string, unknown>;
  const draft = typeof row.draft === "string" ? row.draft : "";
  const turns = Array.isArray(row.turns) ? row.turns.filter(isTurn) : [];
  return { turns, draft };
}

/** Load the saved conversation; corrupt or missing storage yields an empty thread. */
export function loadDocsConversation(
  context: Pick<ExtensionContext, "globalState">,
): DocsConversationState {
  return parseState(context.globalState.get(DOCS_CONVERSATION_KEY));
}

/** Persist turns and draft to globalState only (never workspace files). */
export async function saveDocsConversation(
  context: Pick<ExtensionContext, "globalState">,
  state: DocsConversationState,
): Promise<void> {
  const payload: DocsConversationState = {
    turns: state.turns.map((turn) => ({
      id: turn.id,
      question: turn.question,
      answer: turn.answer,
      citations: structuredClone(turn.citations),
    })),
    draft: state.draft,
  };
  await context.globalState.update(DOCS_CONVERSATION_KEY, payload);
}
