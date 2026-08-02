import type { OfficialDocsLocale } from "@aidlc-guide/shared-types";
import { type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFetchView } from "../hooks/useFetchView.ts";
import {
  fetchOfficialDocsManifest,
  fetchOfficialDocsPage,
  fetchOfficialDocsToc,
} from "../services/api.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
import { MarkdownSurface } from "../viewer/lazy-markdown.ts";
import { AreaError, Skeleton } from "./atoms.tsx";
import { AnchorApplier } from "./docs-shell/AnchorApplier.tsx";
import { DocsToc, flattenToc } from "./docs-shell/DocsToc.tsx";
import { LocaleControl } from "./docs-shell/LocaleControl.tsx";
import { SourceVersionBadge } from "./docs-shell/SourceVersionBadge.tsx";
import { UntranslatedNotice } from "./docs-shell/UntranslatedNotice.tsx";
import { PanelShell } from "./PanelShell.tsx";

/**
 * Official Docs shell (Bolt 2):
 * keep-path locale switch, missing_ja notice, AnchorApplier, wire-only fetch.
 */
export function DocsShell(): ReactNode {
  const open = useAppState().docsShellOpen;
  const dispatch = useDispatch();
  const [locale, setLocale] = useState<OfficialDocsLocale>("en");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  /** Deep-link fragment; preserved across locale switch (FR-B2-1 / FR-B2-3). */
  const [requestedAnchor, setRequestedAnchor] = useState<string | undefined>(undefined);
  const articleRef = useRef<HTMLElement>(null);

  const manifestView = useFetchView(open ? fetchOfficialDocsManifest : null, [open]);
  const tocView = useFetchView(open ? () => fetchOfficialDocsToc(locale) : null, [open, locale]);
  const pageView = useFetchView(
    open && selectedPath !== null
      ? () => fetchOfficialDocsPage(locale, selectedPath, requestedAnchor)
      : null,
    [open, locale, selectedPath, requestedAnchor],
  );

  const manifest = manifestView === null ? null : viewValue(manifestView);
  const toc = tocView === null ? null : viewValue(tocView);
  const page = pageView === null ? null : viewValue(pageView);
  const entries = useMemo(() => (toc === null ? [] : flattenToc(toc)), [toc]);

  useEffect(() => {
    if (!open) {
      setSelectedPath(null);
      setRequestedAnchor(undefined);
      return;
    }
    // FR-B2-1.1 / 1.3 keep-path: never rewrite selectedPath to TOC first entry
    // when the current path is absent from the new locale's TOC.
    setSelectedPath((current) => {
      if (current !== null) return current;
      return entries[0]?.path ?? null;
    });
  }, [open, entries]);

  const onClose = (): void => {
    dispatch({ type: "docs-shell", open: false });
  };

  if (!open) return null;

  const sourceVersion = page?.sourceVersion ?? manifest?.sourceVersion ?? null;
  const title = page?.title ?? "Official Docs";
  const pageError = pageView?.kind === "error";
  const showNotice = !pageError && page?.notice === "missing_ja";

  return (
    <PanelShell
      headingId="docs-shell-heading"
      testId="docs-shell"
      title={
        <>
          <span>{title}</span>
          <SourceVersionBadge sourceVersion={sourceVersion} />
        </>
      }
      closeTestId="docs-shell-close"
      onClose={onClose}
      actions={<LocaleControl locale={locale} onChange={setLocale} />}
    >
      <div className="flex min-w-0 flex-col gap-4 md:flex-row" data-testid="docs-shell-body">
        {tocView?.kind === "error" ? (
          <AreaError detail={tocView.detail} />
        ) : toc === null ? (
          <Skeleton lines={6} label="Official docs TOC" />
        ) : (
          <DocsToc entries={entries} selectedPath={selectedPath} onSelect={setSelectedPath} />
        )}

        <main
          ref={articleRef}
          className="min-w-0 flex-auto"
          data-testid="docs-article"
          aria-labelledby="docs-shell-heading"
          tabIndex={-1}
        >
          {showNotice ? <UntranslatedNotice notice={page?.notice} /> : null}
          {pageError ? (
            <AreaError detail={pageView.detail} />
          ) : page === null ? (
            <Skeleton lines={8} label="Official docs body" />
          ) : (
            <>
              {/* FR-B2-S1 Should: page title as h1 in the article (MarkdownSurface demotes # → h3). */}
              {page.title !== undefined && page.title !== "" ? (
                <h1 data-testid="docs-article-h1" className="sr-only">
                  {page.title}
                </h1>
              ) : null}
              <Suspense fallback={<Skeleton lines={8} label="Official docs body" />}>
                <MarkdownSurface markdown={page.bodyMarkdown} editable={null} />
              </Suspense>
              <AnchorApplier
                anchorApplied={page.anchorApplied}
                anchor={requestedAnchor}
                articleRef={articleRef}
                contentKey={`${locale}:${page.path}:${page.bodyMarkdown.length}`}
              />
            </>
          )}
        </main>
      </div>
    </PanelShell>
  );
}
