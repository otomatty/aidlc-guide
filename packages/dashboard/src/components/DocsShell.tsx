import type { OfficialDocsLocale } from "@aidlc-guide/shared-types";
import { type ReactNode, Suspense, useEffect, useMemo, useState } from "react";
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
import { DocsToc, flattenToc } from "./docs-shell/DocsToc.tsx";
import { LocaleControl } from "./docs-shell/LocaleControl.tsx";
import { SourceVersionBadge } from "./docs-shell/SourceVersionBadge.tsx";
import { UntranslatedNotice } from "./docs-shell/UntranslatedNotice.tsx";
import { PanelShell } from "./PanelShell.tsx";

/**
 * Walking-skeleton Official Docs shell (Bolt 1 / US-02 thin):
 * manifest sourceVersion + locale TOC + page body via MarkdownSurface.
 */
export function DocsShell(): ReactNode {
  const open = useAppState().docsShellOpen;
  const dispatch = useDispatch();
  const [locale, setLocale] = useState<OfficialDocsLocale>("en");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const manifestView = useFetchView(open ? fetchOfficialDocsManifest : null, [open]);
  const tocView = useFetchView(open ? () => fetchOfficialDocsToc(locale) : null, [open, locale]);
  const pageView = useFetchView(
    open && selectedPath !== null ? () => fetchOfficialDocsPage(locale, selectedPath) : null,
    [open, locale, selectedPath],
  );

  const manifest = manifestView === null ? null : viewValue(manifestView);
  const toc = tocView === null ? null : viewValue(tocView);
  const page = pageView === null ? null : viewValue(pageView);
  const entries = useMemo(() => (toc === null ? [] : flattenToc(toc)), [toc]);

  useEffect(() => {
    if (!open) {
      setSelectedPath(null);
      return;
    }
    const first = entries[0]?.path ?? null;
    if (first === null) return;
    setSelectedPath((current) => {
      if (current !== null && entries.some((entry) => entry.path === current)) return current;
      return first;
    });
  }, [open, entries]);

  const onClose = (): void => {
    dispatch({ type: "docs-shell", open: false });
  };

  if (!open) return null;

  const sourceVersion = page?.sourceVersion ?? manifest?.sourceVersion ?? null;
  const title = page?.title ?? "Official Docs";

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

        <div className="min-w-0 flex-auto" data-testid="docs-article">
          <UntranslatedNotice notice={page?.notice} />
          {pageView?.kind === "error" ? (
            <AreaError detail={pageView.detail} />
          ) : page === null ? (
            <Skeleton lines={8} label="Official docs body" />
          ) : (
            <Suspense fallback={<Skeleton lines={8} label="Official docs body" />}>
              <MarkdownSurface markdown={page.bodyMarkdown} editable={null} />
            </Suspense>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
