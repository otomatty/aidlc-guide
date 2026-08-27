import type { OfficialDocsLocale } from "@aidlc-guide/shared-types";
import { MenuIcon } from "lucide-react";
import { type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFetchView } from "../hooks/useFetchView.ts";
import {
  fetchOfficialDocsManifest,
  fetchOfficialDocsPage,
  fetchOfficialDocsToc,
} from "../services/api.ts";
import { isExternal } from "../services/docs.ts";
import { vsCodeApi } from "../services/vscode-api.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
import { MarkdownSurface } from "../viewer/lazy-markdown.ts";
import { AreaError, Skeleton } from "./atoms.tsx";
import { AnchorApplier } from "./docs-shell/AnchorApplier.tsx";
import { DocsToc, flattenToc } from "./docs-shell/DocsToc.tsx";
import { LocaleControl } from "./docs-shell/LocaleControl.tsx";
import { resolveOfficialDocHref } from "./docs-shell/resolve-doc-href.ts";
import { SourceVersionBadge } from "./docs-shell/SourceVersionBadge.tsx";
import { UntranslatedNotice } from "./docs-shell/UntranslatedNotice.tsx";
import { PanelShell } from "./PanelShell.tsx";

function normalizeRequestedAnchor(anchor: string | undefined): string | undefined {
  if (anchor === undefined) return undefined;
  const trimmed = anchor.trim().replace(/^#/, "");
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Official Docs shell (Bolt 2 + Bolt 3 deep-link locale):
 * keep-path locale switch, missing_ja notice, AnchorApplier, wire-only fetch.
 * Deep-link: apply locale before path/anchor; one-shot clear.
 */
export function DocsShell(): ReactNode {
  const {
    docsShellOpen: open,
    docsShellDeepLink: deepLink,
    officialDocsLocale: locale,
  } = useAppState();
  const dispatch = useDispatch();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  /** Deep-link fragment; preserved across locale switch (FR-B2-1 / FR-B2-3). */
  const [requestedAnchor, setRequestedAnchor] = useState<string | undefined>(undefined);
  /** Bumps PanelShell focus when a deep-link lands (incl. no-anchor / unmapped). */
  const [shellLandKey, setShellLandKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  const setLocale = (next: OfficialDocsLocale): void => {
    dispatch({ type: "official-docs-locale", locale: next });
    // Persist to host so panel reload / ready bootstrap keeps LocaleControl choice.
    vsCodeApi()?.postMessage({ type: "official-docs-locale", locale: next });
  };

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
      setDrawerOpen(false);
      return;
    }
    if (deepLink !== null) {
      // FR-B3-4.3: apply locale to LocaleControl before/with path+anchor.
      // Reducer already sets officialDocsLocale on inject; re-dispatch keeps
      // LocaleControl in sync if a future caller sets deepLink without locale action.
      dispatch({ type: "official-docs-locale", locale: deepLink.locale });
      if (deepLink.path !== undefined && deepLink.path !== "") {
        setSelectedPath(deepLink.path);
      }
      setRequestedAnchor(normalizeRequestedAnchor(deepLink.anchor));
      // Move focus into Shell even when anchorApplied is "none" (no fragment).
      setShellLandKey((n) => n + 1);
      // Consume one-shot target so TOC/locale updates do not re-apply it.
      dispatch({ type: "docs-shell", open: true });
      return;
    }
    // FR-B2-1.1 / 1.3 keep-path: never rewrite selectedPath to TOC first entry
    // when the current path is absent from the new locale's TOC.
    setSelectedPath((current) => {
      if (current !== null) return current;
      return entries[0]?.path ?? null;
    });
  }, [open, entries, deepLink, dispatch]);

  const onClose = (): void => {
    dispatch({ type: "docs-shell", open: false });
  };

  const onSelectPath = (path: string): void => {
    setSelectedPath(path);
    setRequestedAnchor(undefined);
    setDrawerOpen(false);
  };

  useEffect(() => {
    const root = articleRef.current;
    if (!open || root === null || selectedPath === null) return;

    const onClick = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (anchor === null || !root.contains(anchor)) return;
      const href = anchor.getAttribute("href");
      if (href === null) return;

      const resolved = resolveOfficialDocHref(selectedPath, href);
      if (resolved !== null) {
        event.preventDefault();
        setSelectedPath(resolved.path);
        setRequestedAnchor(normalizeRequestedAnchor(resolved.anchor));
        setDrawerOpen(false);
        return;
      }
      if (!isExternal(href)) {
        event.preventDefault();
      }
    };

    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("click", onClick);
    };
  }, [open, selectedPath]);

  if (!open) return null;

  const sourceVersion = page?.sourceVersion ?? manifest?.sourceVersion ?? null;
  const title = page?.title ?? "Official Docs";
  const pageError = pageView?.kind === "error";
  const showNotice = !pageError && page?.notice === "missing_ja";

  return (
    <PanelShell
      headingId="docs-shell-heading"
      testId="docs-shell"
      focusKey={shellLandKey}
      title={
        <>
          <span>{title}</span>
          <SourceVersionBadge sourceVersion={sourceVersion} />
        </>
      }
      closeTestId="docs-shell-close"
      onClose={onClose}
      onEscapeKeyDown={(event) => {
        if (drawerOpen) {
          event.preventDefault();
          setDrawerOpen(false);
          return;
        }
        onClose();
      }}
      leading={
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-testid="docs-menu"
                aria-label="ドキュメント一覧"
                aria-expanded={drawerOpen}
                aria-haspopup="dialog"
                onClick={() => {
                  setDrawerOpen(true);
                }}
              />
            }
          >
            <MenuIcon />
          </TooltipTrigger>
          <TooltipContent>ドキュメント一覧</TooltipContent>
        </Tooltip>
      }
      actions={<LocaleControl locale={locale} onChange={setLocale} />}
    >
      {/* Same chrome as GuidesPanel: markdown body here, TOC in the left Sheet. */}
      <div className="min-w-0 flex-none" data-testid="docs-shell-body">
        <main
          ref={articleRef}
          className="min-w-0"
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
              {/* AnchorApplier must sit inside Suspense so it mounts after MarkdownSurface commits. */}
              <Suspense fallback={<Skeleton lines={8} label="Official docs body" />}>
                <MarkdownSurface markdown={page.bodyMarkdown} editable={null} />
                <AnchorApplier
                  anchorApplied={page.anchorApplied}
                  anchor={requestedAnchor}
                  articleRef={articleRef}
                  contentKey={`${locale}:${page.path}:${page.bodyMarkdown.length}`}
                />
              </Suspense>
            </>
          )}
        </main>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" data-testid="docs-drawer" className="w-[min(20rem,100%)]">
          <SheetHeader>
            <SheetTitle>公式ドキュメント</SheetTitle>
            <SheetDescription>読みたいページを選んでください。</SheetDescription>
          </SheetHeader>
          {tocView?.kind === "error" ? (
            <div className="px-4 pb-4">
              <AreaError detail={tocView.detail} />
            </div>
          ) : toc === null ? (
            <div className="px-4 pb-4">
              <Skeleton lines={6} label="公式ドキュメント一覧" />
            </div>
          ) : (
            <DocsToc entries={entries} selectedPath={selectedPath} onSelect={onSelectPath} />
          )}
        </SheetContent>
      </Sheet>
    </PanelShell>
  );
}
