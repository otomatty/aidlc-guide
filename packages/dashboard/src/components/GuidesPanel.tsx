import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { lazy, type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { fetchGuide, fetchGuides, type GuideInfo } from "../services/api.ts";
import { AreaError, Skeleton } from "./atoms.tsx";

const MarkdownSurface = lazy(async () => {
  const mod = await import("../viewer/MarkdownSurface.tsx");
  return { default: mod.MarkdownSurface };
});

const GUIDE_HREF = /^(?:\.\/)?([a-z0-9][a-z0-9-]*)\.md(?:#.*)?$/i;

/** Sibling `*.md` under docs/guides — keep navigation inside the panel. */
function resolveGuideHref(href: string): string | null {
  const match = GUIDE_HREF.exec(href.trim());
  return match?.[1] === undefined ? null : `${match[1]}.md`;
}

const preventDefault = (event: Event): void => {
  event.preventDefault();
};

export function GuidesPanel({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  const heading = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<Element | null>(null);
  const [list, setList] = useState<GuideInfo[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("使い方ガイド");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [loadingBody, setLoadingBody] = useState(false);

  useEffect(() => {
    if (!open) return;
    trigger.current = document.activeElement;
    heading.current?.focus();
    return () => {
      const opener = trigger.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setListError(null);
    void fetchGuides().then((result) => {
      if (!live) return;
      if ("ok" in result) {
        setList(result.value);
        const first = result.value[0]?.name ?? null;
        setSelected((current) => current ?? first);
      } else if ("error" in result) {
        setListError(result.reason);
        setList([]);
      }
    });
    return () => {
      live = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open || selected === null) return;
    let live = true;
    setLoadingBody(true);
    setBodyError(null);
    setMarkdown(null);
    void fetchGuide(selected).then((result) => {
      if (!live) return;
      setLoadingBody(false);
      if ("ok" in result) {
        setMarkdown(result.value.markdown);
        setTitle(result.value.title);
      } else if ("error" in result) {
        setBodyError(result.reason);
      }
    });
    return () => {
      live = false;
    };
  }, [open, selected]);

  // Event delegation (not a clickable surface): sibling guide links stay in-panel.
  useEffect(() => {
    const el = bodyRef.current;
    if (!open || el === null) return;
    const onClick = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (anchor === null) return;
      const href = anchor.getAttribute("href");
      if (href === null || list === null) return;
      const name = resolveGuideHref(href);
      if (name === null) return;
      const match = list.find((guide) => guide.name.toLowerCase() === name.toLowerCase());
      if (match === undefined) return;
      event.preventDefault();
      setSelected(match.name);
    };
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("click", onClick);
    };
  }, [open, list]);

  if (!open) return null;

  return (
    <FocusScope asChild trapped={false} onUnmountAutoFocus={preventDefault}>
      <DismissableLayer
        asChild
        onEscapeKeyDown={onClose}
        onPointerDownOutside={onClose}
        onFocusOutside={(event) => {
          event.preventDefault();
        }}
      >
        <aside
          className="panel panel--guides"
          aria-labelledby="guides-heading"
          data-testid="guides-panel"
        >
          <div className="panel__bar">
            <h2 id="guides-heading" className="panel__heading" ref={heading} tabIndex={-1}>
              {title}
            </h2>
            <button type="button" className="button" onClick={onClose} data-testid="guides-close">
              ✕ 閉じる
            </button>
          </div>

          <div className="guides">
            <nav className="guides__nav" aria-label="使い方ガイド一覧">
              {listError !== null ? (
                <AreaError detail={listError} />
              ) : list === null ? (
                <Skeleton lines={4} label="ガイド一覧" />
              ) : list.length === 0 ? (
                <p className="guides__empty">ガイドがありません。</p>
              ) : (
                <ul className="guides__list">
                  {list.map((guide) => (
                    <li key={guide.name}>
                      <button
                        type="button"
                        className="guides__item"
                        data-active={guide.name === selected}
                        data-testid={`guide-item-${guide.name}`}
                        onClick={() => {
                          setSelected(guide.name);
                        }}
                      >
                        {guide.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </nav>

            <div className="guides__body" data-testid="guides-body" ref={bodyRef}>
              {bodyError !== null ? (
                <AreaError detail={bodyError} />
              ) : loadingBody || markdown === null ? (
                <Skeleton lines={8} label="ガイド本文" />
              ) : (
                <Suspense fallback={<Skeleton lines={8} label="ガイド本文" />}>
                  <MarkdownSurface markdown={markdown} editable={null} />
                </Suspense>
              )}
            </div>
          </div>
        </aside>
      </DismissableLayer>
    </FocusScope>
  );
}
