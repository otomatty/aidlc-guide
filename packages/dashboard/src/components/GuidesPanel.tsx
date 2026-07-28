import type { MarkdownItem } from "@aidlc-guide/shared-types";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { MenuIcon, XIcon } from "lucide-react";
import { lazy, type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchGuide, fetchGuides } from "../services/api.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { AreaError, Skeleton } from "./atoms.tsx";

const MarkdownSurface = lazy(async () => {
  const mod = await import("../viewer/MarkdownSurface.tsx");
  return { default: mod.MarkdownSurface };
});

const GUIDE_HREF = /^(?:\.\/)?([a-z0-9][a-z0-9-]*)\.md(?:#.*)?$/i;

function resolveGuideHref(href: string): string | null {
  const match = GUIDE_HREF.exec(href.trim());
  return match?.[1] === undefined ? null : `${match[1]}.md`;
}

const preventDefault = (event: Event): void => {
  event.preventDefault();
};

export function GuidesPanel(): ReactNode {
  const open = useAppState().guidesOpen;
  const dispatch = useDispatch();
  const heading = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<Element | null>(null);
  const [list, setList] = useState<MarkdownItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("使い方ガイド");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [loadingBody, setLoadingBody] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const onClose = (): void => {
    dispatch({ type: "guides", open: false });
  };

  useEffect(() => {
    if (!open) {
      setDrawerOpen(false);
      return;
    }
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

  const pickGuide = (name: string): void => {
    setSelected(name);
    setDrawerOpen(false);
  };

  return (
    <FocusScope asChild trapped={false} onUnmountAutoFocus={preventDefault}>
      <DismissableLayer
        asChild
        onEscapeKeyDown={(event) => {
          if (drawerOpen) {
            event.preventDefault();
            setDrawerOpen(false);
            return;
          }
          onClose();
        }}
        onFocusOutside={(event) => {
          event.preventDefault();
        }}
      >
        <aside className="panel" aria-labelledby="guides-heading" data-testid="guides-panel">
          <div className="panel__bar">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    data-testid="guides-menu"
                    aria-label="ガイド一覧"
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
              <TooltipContent>ガイド一覧</TooltipContent>
            </Tooltip>
            <h2 id="guides-heading" className="panel__heading" ref={heading} tabIndex={-1}>
              {title}
            </h2>
            <div className="panel__actions">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onClose}
                data-testid="guides-close"
                aria-label="閉じる"
                title="閉じる"
              >
                <XIcon />
              </Button>
            </div>
          </div>

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

          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetContent side="left" data-testid="guides-drawer" className="w-[min(20rem,100%)]">
              <SheetHeader>
                <SheetTitle>使い方ガイド</SheetTitle>
                <SheetDescription>読みたいガイドを選んでください。</SheetDescription>
              </SheetHeader>
              <nav className="guides__nav px-4 pb-4" aria-label="使い方ガイド一覧">
                {listError !== null ? (
                  <AreaError detail={listError} />
                ) : list === null ? (
                  <Skeleton lines={4} label="ガイド一覧" />
                ) : list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ガイドがありません。</p>
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
                            pickGuide(guide.name);
                          }}
                        >
                          {guide.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </aside>
      </DismissableLayer>
    </FocusScope>
  );
}
