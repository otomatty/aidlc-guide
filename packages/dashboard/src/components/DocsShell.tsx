import type {
  DocsQaCitation,
  DocsQaEvidence,
  DocsQaJob,
  OfficialDocsLocale,
} from "@aidlc-guide/shared-types";
import { ArrowLeftIcon, HouseIcon, MenuIcon, MessageCircleIcon } from "lucide-react";
import { type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  fetchGuide,
  fetchGuides,
  fetchOfficialDocsManifest,
  fetchOfficialDocsPage,
  fetchOfficialDocsToc,
} from "../services/api.ts";
import { isExternal } from "../services/docs.ts";
import { docsQaApi } from "../services/docs-qa.ts";
import { vsCodeApi } from "../services/vscode-api.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
import { MarkdownSurface } from "../viewer/lazy-markdown.ts";
import { AreaError, Skeleton } from "./atoms.tsx";
import { AnchorApplier } from "./docs-shell/AnchorApplier.tsx";
import { DocsHome } from "./docs-shell/DocsHome.tsx";
import { DocsNavigation } from "./docs-shell/DocsNavigation.tsx";
import { DocsQuestionPanel } from "./docs-shell/DocsQuestionPanel.tsx";
import { flattenToc } from "./docs-shell/DocsToc.tsx";
import { type DocsCategory, resolveGuideHref } from "./docs-shell/docs-navigation.ts";
import { EvidenceApplier } from "./docs-shell/EvidenceApplier.tsx";
import { LocaleControl } from "./docs-shell/LocaleControl.tsx";
import { resolveOfficialDocHref } from "./docs-shell/resolve-doc-href.ts";
import { SourceVersionBadge } from "./docs-shell/SourceVersionBadge.tsx";
import { UntranslatedNotice } from "./docs-shell/UntranslatedNotice.tsx";
import { useDocsQa } from "./docs-shell/useDocsQa.ts";
import { PanelShell } from "./PanelShell.tsx";

function normalizeRequestedAnchor(anchor: string | undefined): string | undefined {
  if (anchor === undefined) return undefined;
  const trimmed = anchor.trim().replace(/^#/, "");
  return trimmed === "" ? undefined : trimmed;
}

type DocSelection = { kind: "official"; path: string } | { kind: "guide"; name: string };

/** ワークフローと拡張機能の一覧と記事を同じページで開く。外部からの記事リンクもここに着地する。 */
export function DocsShell(): ReactNode {
  const {
    docsShellOpen: open,
    docsShellDeepLink: deepLink,
    officialDocsLocale: locale,
    hostMode,
  } = useAppState();
  const dispatch = useDispatch();
  const [selection, setSelection] = useState<DocSelection | null>(null);
  const [category, setCategory] = useState<DocsCategory>("workflow");
  const selectedPath = selection?.kind === "official" ? selection.path : null;
  const selectedGuide = selection?.kind === "guide" ? selection.name : null;
  /** Deep-link fragment; preserved across locale switch (FR-B2-1 / FR-B2-3). */
  const [requestedAnchor, setRequestedAnchor] = useState<string | undefined>(undefined);
  /** Bumps PanelShell focus when a deep-link lands (incl. no-anchor / unmapped). */
  const [shellLandKey, setShellLandKey] = useState(0);
  /** Re-runs AnchorApplier when the same path+fragment is clicked again. */
  const [applyKey, setApplyKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const qa = useDocsQa(open, locale);
  const [reference, setReference] = useState<{
    citation: DocsQaCitation;
    turn: DocsQaJob;
    data?: DocsQaEvidence;
    error?: string;
  } | null>(null);
  const evidenceRequest = useRef(0);
  const answerPosition = useRef<{ top: number; turnId: string; locale: OfficialDocsLocale } | null>(
    null,
  );
  const [returnKey, setReturnKey] = useState(0);

  const clearReference = (): void => {
    evidenceRequest.current += 1;
    setReference(null);
  };

  const setLocale = (next: OfficialDocsLocale): void => {
    if (next !== locale) clearReference();
    dispatch({ type: "official-docs-locale", locale: next });
    // Persist to host so panel reload / ready bootstrap keeps LocaleControl choice.
    vsCodeApi()?.postMessage({ type: "official-docs-locale", locale: next });
  };

  const manifestView = useFetchView(open ? fetchOfficialDocsManifest : null, [open]);
  const tocView = useFetchView(open ? () => fetchOfficialDocsToc(locale) : null, [open, locale]);
  const guidesView = useFetchView(open ? fetchGuides : null, [open]);
  const pageView = useFetchView(
    open && selectedPath !== null
      ? () => fetchOfficialDocsPage(locale, selectedPath, requestedAnchor)
      : null,
    [open, locale, selectedPath, requestedAnchor],
  );
  const guideView = useFetchView(
    open && selectedGuide !== null ? () => fetchGuide(selectedGuide) : null,
    [open, selectedGuide],
  );

  const manifest = manifestView === null ? null : viewValue(manifestView);
  const toc = tocView === null ? null : viewValue(tocView);
  const page = pageView === null ? null : viewValue(pageView);
  const guide = guideView === null ? null : viewValue(guideView);
  const guides = guidesView === null ? null : viewValue(guidesView);
  const entries = useMemo(() => (toc === null ? [] : flattenToc(toc)), [toc]);
  const knownPaths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  const guideNames = useMemo(() => guides?.map((entry) => entry.name) ?? [], [guides]);

  useEffect(() => {
    if (!open) {
      evidenceRequest.current += 1;
      setReference(null);
      setSelection(null);
      setCategory("workflow");
      setRequestedAnchor(undefined);
      setDrawerOpen(false);
      return;
    }
    if (deepLink !== null) {
      evidenceRequest.current += 1;
      setReference(null);
      // FR-B3-4.3: apply locale to LocaleControl before/with path+anchor.
      // Reducer already sets officialDocsLocale on inject; re-dispatch keeps
      // LocaleControl in sync if a future caller sets deepLink without locale action.
      dispatch({ type: "official-docs-locale", locale: deepLink.locale });
      if (deepLink.guide !== undefined && deepLink.guide !== "") {
        setSelection({ kind: "guide", name: deepLink.guide });
        setCategory("extension");
      } else if (deepLink.path !== undefined && deepLink.path !== "") {
        setSelection({ kind: "official", path: deepLink.path });
        setCategory("workflow");
      } else {
        setSelection(null);
        setCategory("workflow");
      }
      setDrawerOpen(false);
      setRequestedAnchor(normalizeRequestedAnchor(deepLink.anchor));
      // Move focus into Shell even when anchorApplied is "none" (no fragment).
      setShellLandKey((n) => n + 1);
      // A repeated host link still navigates even when path/anchor need no refetch.
      setApplyKey((n) => n + 1);
      // Consume one-shot target so TOC/locale updates do not re-apply it.
      dispatch({ type: "docs-shell", open: true });
      return;
    }
    // 通常の入口ではトップを表示し、言語切り替え時は選んだ記事を保つ。
  }, [open, deepLink, dispatch]);

  const onClose = (): void => {
    dispatch({ type: "docs-shell", open: false });
  };

  const onSelectPath = (path: string): void => {
    clearReference();
    setSelection({ kind: "official", path });
    setCategory("workflow");
    setRequestedAnchor(undefined);
    setApplyKey((n) => n + 1);
    setDrawerOpen(false);
  };

  const onSelectGuide = (name: string): void => {
    clearReference();
    setSelection({ kind: "guide", name });
    setCategory("extension");
    setRequestedAnchor(undefined);
    setApplyKey((n) => n + 1);
    setDrawerOpen(false);
  };

  const onHome = (): void => {
    if (reference && answerPosition.current)
      dispatch({ type: "official-docs-locale", locale: answerPosition.current.locale });
    clearReference();
    setSelection(null);
    setRequestedAnchor(undefined);
    setDrawerOpen(false);
    setShellLandKey((n) => n + 1);
    articleRef.current?.scrollIntoView({ block: "start" });
  };

  const onOpenCategory = (next: DocsCategory): void => {
    setCategory(next);
    setDrawerOpen(true);
  };

  const onCitation = async (citation: DocsQaCitation, turn: DocsQaJob): Promise<void> => {
    if (reference === null)
      answerPosition.current = {
        top: document.querySelector('[data-testid="app-scroll"]')?.scrollTop ?? 0,
        turnId: turn.id,
        locale,
      };
    const request = ++evidenceRequest.current;
    setReference({ citation, turn });
    dispatch({ type: "official-docs-locale", locale: citation.target.locale });
    setSelection(
      citation.target.kind === "guide"
        ? { kind: "guide", name: citation.target.path }
        : { kind: "official", path: citation.target.path },
    );
    setCategory(citation.target.kind === "guide" ? "extension" : "workflow");
    setRequestedAnchor(undefined);
    setDrawerOpen(false);
    setApplyKey((key) => key + 1);
    articleRef.current?.scrollIntoView({ block: "start" });
    try {
      const data = await docsQaApi.evidence(citation);
      if (request === evidenceRequest.current) setReference({ citation, turn, data });
    } catch (cause) {
      if (request === evidenceRequest.current)
        setReference({
          citation,
          turn,
          error: cause instanceof Error ? cause.message : "参照元を読み込めませんでした。",
        });
    }
  };

  const returnToAnswer = (): void => {
    if (answerPosition.current)
      dispatch({ type: "official-docs-locale", locale: answerPosition.current.locale });
    clearReference();
    setSelection(null);
    setRequestedAnchor(undefined);
    setReturnKey((key) => key + 1);
  };

  // Restore after the answer cards are back in the DOM, without discarding the draft.
  useEffect(() => {
    if (returnKey === 0 || !answerPosition.current) return;
    const position = answerPosition.current;
    const scroll = document.querySelector('[data-testid="app-scroll"]');
    if (scroll) scroll.scrollTop = position.top;
    document.getElementById(`docs-answer-${position.turnId}`)?.focus({ preventScroll: true });
  }, [returnKey]);

  const askAboutDocument = (): void => {
    if (!selection) return;
    qa.setTarget(
      selection.kind === "guide"
        ? { kind: "guide", path: selection.name, locale: "ja" }
        : { kind: "official", path: selection.path, locale },
    );
    onHome();
    requestAnimationFrame(() => document.getElementById("docs-question")?.focus());
  };

  useEffect(() => {
    const root = articleRef.current;
    if (!open || root === null || selection === null) return;

    const onClick = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (anchor === null || !root.contains(anchor)) return;
      const href = anchor.getAttribute("href");
      if (href === null) return;

      if (selection.kind === "official") {
        const resolved = resolveOfficialDocHref(selection.path, href, knownPaths);
        if (resolved !== null) {
          event.preventDefault();
          evidenceRequest.current += 1;
          setReference(null);
          setSelection({ kind: "official", path: resolved.path });
          setCategory("workflow");
          setRequestedAnchor(normalizeRequestedAnchor(resolved.anchor));
          setApplyKey((n) => n + 1);
          setDrawerOpen(false);
          return;
        }
      } else {
        const resolved = resolveGuideHref(selection.name, href, guideNames);
        if (resolved !== null) {
          event.preventDefault();
          evidenceRequest.current += 1;
          setReference(null);
          setSelection({ kind: "guide", name: resolved.name });
          setCategory("extension");
          setRequestedAnchor(normalizeRequestedAnchor(resolved.anchor));
          setApplyKey((n) => n + 1);
          setDrawerOpen(false);
          return;
        }
      }
      if (!isExternal(href)) {
        event.preventDefault();
      }
    };

    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("click", onClick);
    };
  }, [open, selection, knownPaths, guideNames]);

  if (!open) return null;

  const sourceVersion = page?.sourceVersion ?? manifest?.sourceVersion ?? null;
  const isGuide = selection?.kind === "guide";
  const title =
    selection === null
      ? "ドキュメント"
      : isGuide
        ? (guide?.title ?? "拡張機能")
        : (page?.title ?? "公式ドキュメント");
  const articleView = isGuide ? guideView : pageView;
  const markdown =
    reference !== null ? reference.data?.markdown : isGuide ? guide?.markdown : page?.bodyMarkdown;
  const showNotice = !isGuide && pageView?.kind !== "error" && page?.notice === "missing_ja";
  const anchorApplied = isGuide
    ? requestedAnchor === undefined
      ? "top"
      : "scrolled"
    : requestedAnchor === undefined && page?.anchorApplied === "none"
      ? "top"
      : page?.anchorApplied;

  return (
    <PanelShell
      headingId="docs-shell-heading"
      testId="docs-shell"
      headingFont="body"
      hideHeading
      focusKey={shellLandKey}
      returnFocusSelector='[data-testid="header-menu-trigger"]'
      title={title}
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
      actions={
        <>
          {selection !== null ? (
            <Button type="button" variant="ghost" size="sm" onClick={askAboutDocument}>
              <MessageCircleIcon data-icon="inline-start" />
              この文書について質問
            </Button>
          ) : null}
          {selection?.kind === "official" ? (
            <SourceVersionBadge sourceVersion={sourceVersion} />
          ) : null}
          {!isGuide ? <LocaleControl locale={locale} onChange={setLocale} /> : null}
        </>
      }
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
          {reference ? (
            <section
              className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background px-4 py-3"
              aria-label="回答の参照元"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={returnToAnswer}>
                  <ArrowLeftIcon data-icon="inline-start" />
                  回答に戻る
                </Button>
                <span className="text-sm text-muted-foreground">
                  参照 [{reference.citation.id}] · {reference.citation.target.locale.toUpperCase()}{" "}
                  · {reference.citation.version}
                </span>
                {reference.turn.citations.length > 1 ? (
                  <div className="flex gap-1">
                    {reference.turn.citations.map((citation) => (
                      <Button
                        key={citation.id}
                        type="button"
                        variant={citation.id === reference.citation.id ? "secondary" : "ghost"}
                        size="sm"
                        aria-label={`参照 ${citation.id} を表示`}
                        aria-current={citation.id === reference.citation.id ? "true" : undefined}
                        onClick={() => {
                          void onCitation(citation, reference.turn);
                        }}
                      >
                        [{citation.id}]
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
              <details className="text-sm text-muted-foreground">
                <summary className="cursor-pointer">回答時の引用文を見る</summary>
                <blockquote className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap border-l-2 pl-3">
                  {reference.citation.quote}
                </blockquote>
              </details>
              {reference.data && !reference.data.matches ? (
                <Alert>
                  <AlertTitle>回答後に文書が更新されています</AlertTitle>
                  <AlertDescription>
                    最新の本文を表示しています。引用位置が変わっている可能性があるため、ハイライトを解除しました。
                  </AlertDescription>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={qa.busy}
                    onClick={() => {
                      const question = reference.turn.question;
                      returnToAnswer();
                      void qa.submit(question, {
                        locale: reference.turn.locale ?? answerPosition.current?.locale,
                        target: reference.turn.target,
                      });
                    }}
                  >
                    最新の文書で回答を更新
                  </Button>
                </Alert>
              ) : null}
              {reference.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{reference.error}</AlertDescription>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void onCitation(reference.citation, reference.turn);
                    }}
                  >
                    参照元を再読み込み
                  </Button>
                </Alert>
              ) : null}
            </section>
          ) : null}
          {selection !== null && reference === null && showNotice ? (
            <UntranslatedNotice notice={page?.notice} />
          ) : null}
          {selection === null ? (
            <DocsHome
              onOpenCategory={onOpenCategory}
              questionPanel={
                <DocsQuestionPanel
                  qa={qa}
                  hostMode={hostMode}
                  onCitation={(citation, turn) => {
                    void onCitation(citation, turn);
                  }}
                />
              }
            />
          ) : reference?.error ? null : reference === null && articleView?.kind === "error" ? (
            <AreaError detail={articleView.detail} />
          ) : markdown === undefined ? (
            <Skeleton lines={8} label="Official docs body" />
          ) : (
            <>
              {/* FR-B2-S1 Should: page title as h1 in the article (MarkdownSurface demotes # → h3). */}
              {title !== "" ? (
                <h1 data-testid="docs-article-h1" className="sr-only">
                  {title}
                </h1>
              ) : null}
              {/* AnchorApplier must sit inside Suspense so it mounts after MarkdownSurface commits. */}
              <Suspense fallback={<Skeleton lines={8} label="Official docs body" />}>
                <MarkdownSurface
                  markdown={markdown}
                  editable={null}
                  evidence={
                    reference?.data?.matches
                      ? {
                          startLine: reference.citation.startLine,
                          endLine: reference.citation.endLine,
                          label: `参照 ${reference.citation.id} の根拠`,
                        }
                      : undefined
                  }
                />
                {reference ? (
                  reference.data?.matches ? (
                    <EvidenceApplier
                      articleRef={articleRef}
                      contentKey={`${reference.citation.sourceId}:${applyKey}`}
                    />
                  ) : null
                ) : (
                  <AnchorApplier
                    // No fragment → server sends none and would leave the panel
                    // scrolled. Treat that as top so in-app page changes start
                    // at the article head (deep-link missing headings already use top).
                    anchorApplied={anchorApplied}
                    anchor={requestedAnchor}
                    articleRef={articleRef}
                    contentKey={`${locale}:${selectedPath ?? selectedGuide}:${markdown.length}:${applyKey}`}
                  />
                )}
              </Suspense>
            </>
          )}
        </main>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          data-testid="docs-drawer"
          className="data-[side=left]:w-full data-[side=left]:sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>ドキュメント一覧</SheetTitle>
            <SheetDescription>種類を切り替えて、読みたいページを選んでください。</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <Button type="button" variant="ghost" size="sm" onClick={onHome}>
              <HouseIcon data-icon="inline-start" />
              トップページへ
            </Button>
          </div>
          <DocsNavigation
            category={category}
            onCategoryChange={setCategory}
            tocView={tocView}
            guidesView={guidesView}
            selectedPath={selectedPath}
            selectedGuide={selectedGuide}
            onSelectPath={onSelectPath}
            onSelectGuide={onSelectGuide}
          />
        </SheetContent>
      </Sheet>
    </PanelShell>
  );
}
