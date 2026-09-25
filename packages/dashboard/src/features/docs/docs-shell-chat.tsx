import type { DocsQaCitation, DocsQaJob } from "@aidlc-guide/shared-types";
import type { ReactNode } from "react";
import { DocsHome } from "@/features/docs/components/DocsHome.tsx";
import { DocsChat } from "@/features/docs/DocsChat.tsx";
import type { DocsQaState } from "@/features/docs/hooks/useDocsQa.ts";
import type { DocsCategory } from "@/features/docs/types.ts";

/** Home keeps the entry only; turns move the user onto the chat screen. */
export function docsShellShowsChat(
  qa: Pick<DocsQaState, "turns" | "busy" | "submitting">,
): boolean {
  return qa.turns.length > 0 || qa.busy || qa.submitting;
}

export function DocsShellQuestionSurface({
  qa,
  hostMode,
  onCitation,
  onOpenCategory,
}: {
  qa: DocsQaState;
  hostMode: boolean;
  onCitation: (citation: DocsQaCitation, turn: DocsQaJob) => void;
  onOpenCategory: (category: DocsCategory) => void;
}): ReactNode {
  if (docsShellShowsChat(qa)) {
    return <DocsChat mode="chat" hostMode={hostMode} qa={qa} onCitation={onCitation} />;
  }
  return (
    <DocsHome
      onOpenCategory={onOpenCategory}
      questionPanel={<DocsChat mode="entry" hostMode={hostMode} qa={qa} onCitation={onCitation} />}
    />
  );
}
