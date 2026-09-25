import type { DocsQaCitation, DocsQaJob } from "@aidlc-guide/shared-types";
import type { ReactElement } from "react";
import { DocsQuestionPanel } from "@/features/docs/components/qa/DocsQuestionPanel.tsx";
import type { DocsQaState } from "@/features/docs/hooks/useDocsQa.ts";

export type DocsChatMode = "entry" | "chat";

export function DocsChat({
  qa,
  hostMode,
  onCitation,
  mode,
}: {
  qa: DocsQaState;
  hostMode: boolean;
  onCitation: (citation: DocsQaCitation, turn: DocsQaJob) => void;
  mode: DocsChatMode;
}): ReactElement {
  // Wide: centered column. Narrow: vertical stack without a fixed max width.
  const layout =
    mode === "chat"
      ? "flex w-full flex-col gap-5 md:mx-auto md:max-w-3xl"
      : "flex w-full flex-col gap-4";

  return (
    <section
      data-testid={mode === "entry" ? "docs-question-entry" : "docs-chat"}
      className={layout}
    >
      <DocsQuestionPanel
        qa={mode === "entry" ? { ...qa, turns: [] } : qa}
        hostMode={hostMode}
        onCitation={onCitation}
      />
    </section>
  );
}
