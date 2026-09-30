import { type ReactNode, type RefObject, useEffect, useState } from "react";
import { focusHeading } from "../utils/focus-heading.ts";

export interface PageOutlineEntry {
  text: string;
  /** Markdown depth: 2 for `##`, 3 for `###`. */
  level: 2 | 3;
  element: HTMLElement;
}

/**
 * MarkdownSurface demotes every heading by two levels so the panel keeps the
 * outline root: `##` renders as <h4> and `###` as <h5>. The outline lists
 * those two depths; `#` is the page title and anything deeper is too fine.
 *
 * Read from the rendered DOM rather than re-parsed from the Markdown, so an
 * entry is exactly the heading the reader will land on — no second parser to
 * drift from the renderer, and `marked` stays out of the Docs shell chunk.
 */
export function readPageOutline(root: ParentNode): PageOutlineEntry[] {
  const entries: PageOutlineEntry[] = [];
  for (const node of root.querySelectorAll<HTMLElement>("h4, h5")) {
    const text = (node.textContent ?? "").trim();
    if (text === "") continue;
    entries.push({ text, level: node.tagName === "H4" ? 2 : 3, element: node });
  }
  return entries;
}

function sameOutline(a: readonly PageOutlineEntry[], b: readonly PageOutlineEntry[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (entry, index) =>
        entry.element === b[index]?.element &&
        entry.text === b[index]?.text &&
        entry.level === b[index]?.level,
    )
  );
}

/** Below this, a list of sections tells the reader nothing the page does not. */
const MIN_ENTRIES = 2;

/**
 * "このページの内容": the article's sections, beside it on a wide panel
 * (app.css hides it below the container breakpoint). Entries are buttons, not
 * `#fragment` links — the article's link handler treats fragments as page
 * navigation and re-fetches; a jump within the open page needs neither.
 */
export function DocsPageOutline({
  contentRef,
}: {
  contentRef: RefObject<HTMLElement | null>;
}): ReactNode {
  const [entries, setEntries] = useState<PageOutlineEntry[]>([]);
  const [current, setCurrent] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const root = contentRef.current;
    if (root === null) return;
    // The Markdown body mounts lazily (Suspense) and swaps on every page
    // change, so follow the DOM instead of reading it once.
    const refresh = (): void => {
      const next = readPageOutline(root);
      setEntries((previous) => (sameOutline(previous, next) ? previous : next));
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
    };
  }, [contentRef]);

  if (entries.length < MIN_ENTRIES) return null;

  return (
    <nav className="docs-outline" aria-label="このページの内容" data-testid="docs-page-outline">
      <p className="docs-outline__title">このページの内容</p>
      <ul className="docs-outline__list">
        {entries.map((entry, index) => (
          <li key={index}>
            <button
              type="button"
              className="docs-outline__entry"
              data-level={entry.level}
              aria-current={entry.element === current ? "location" : undefined}
              onClick={() => {
                setCurrent(entry.element);
                focusHeading(entry.element);
              }}
            >
              {entry.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
