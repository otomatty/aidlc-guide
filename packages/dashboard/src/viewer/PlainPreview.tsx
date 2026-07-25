import type { ReactNode } from "react";

/**
 * The fallback rendering path, and the *only* one that is guaranteed not to
 * throw: raw Markdown as text.
 *
 * The text is passed as a React child, so React creates a text node — there is
 * no HTML parsing step anywhere on this path (S-AV-3). `dangerouslySetInnerHTML`
 * is banned package-wide by Biome and by `dependency-direction.test.ts`.
 *
 * Reached three ways: MarkdownSurface's ErrorBoundary (D3 error(b)), the >1MB
 * short-circuit (P-AV-5), and a renderer that reports it cannot cope.
 */
export function PlainPreview({ markdown, note }: { markdown: string; note?: string }): ReactNode {
  return (
    <div className="viewer__plain" data-testid="plain-preview">
      {note === undefined ? null : (
        <p className="viewer__note" role="status">
          {note}
        </p>
      )}
      <pre className="viewer__raw">{markdown}</pre>
    </div>
  );
}
