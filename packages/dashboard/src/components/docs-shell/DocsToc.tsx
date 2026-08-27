import type { OfficialDocsToc, OfficialDocsTocNode } from "@aidlc-guide/shared-types";
import type { ReactNode } from "react";
import { NavList, NavListButton } from "../NavList.tsx";

export interface TocEntry {
  id: string;
  title: string;
  path: string;
}

/**
 * Flat page list behind the tree: deep-link path matching, in-body link
 * resolution (`knownPaths`), and the default selection all match on path, not
 * on nav shape. Category rows without a page contribute nothing.
 */
export function flattenToc(tree: OfficialDocsToc): TocEntry[] {
  const out: TocEntry[] = [];
  const walk = (nodes: readonly OfficialDocsTocNode[]): void => {
    for (const node of nodes) {
      if (node.path !== undefined && node.path !== "") {
        out.push({ id: node.id, title: node.title, path: node.path });
      }
      walk(node.children);
    }
  };
  walk(tree.guide);
  walk(tree.reference);
  return out;
}

/** The two bundled books, in reading order. Headings match the panel chrome. */
const BOOKS: ReadonlyArray<{ key: keyof OfficialDocsToc; title: string }> = [
  { key: "guide", title: "ユーザーガイド" },
  { key: "reference", title: "開発者リファレンス" },
];

/**
 * One nav row and, when the node has children, the list nested beneath it.
 * A node without a page is a category label rather than a button, so a folder
 * with no `README.md` still groups its pages without pretending to be one.
 */
function TocNodeRow({
  node,
  selectedPath,
  onSelect,
}: {
  node: OfficialDocsTocNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}): ReactNode {
  const path = node.path !== undefined && node.path !== "" ? node.path : null;
  return (
    <li>
      {path === null ? (
        // Directory with no README: a category label, not a link.
        <p
          className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
          data-testid={`docs-toc-group-${node.id}`}
        >
          {node.title}
        </p>
      ) : (
        <NavListButton
          data-active={path === selectedPath}
          data-testid={`docs-toc-${path}`}
          onClick={() => {
            onSelect(path);
          }}
        >
          {node.title}
        </NavListButton>
      )}
      {node.children.length === 0 ? null : (
        <NavList className="mt-1 ml-3 border-l border-border pl-2">
          {node.children.map((child) => (
            <TocNodeRow
              key={child.id}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </NavList>
      )}
    </li>
  );
}

export interface DocsTocProps {
  tree: OfficialDocsToc;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

/**
 * Official-docs nav — lives in the left Sheet, same chrome as the usage-guide
 * list. Books stay separate and folders stay nested: the categories are the
 * aidlc-workflows directory layout, not a taxonomy of our own.
 */
export function DocsToc({ tree, selectedPath, onSelect }: DocsTocProps): ReactNode {
  const books = BOOKS.filter((book) => tree[book.key].length > 0);
  return (
    <nav
      className="min-h-0 overflow-y-auto px-4 pb-4"
      aria-label="公式ドキュメント一覧"
      data-testid="docs-toc"
    >
      {books.length === 0 ? (
        <p className="text-sm text-muted-foreground">ドキュメントがありません。</p>
      ) : (
        books.map((book) => (
          <section
            key={book.key}
            className="mb-4 last:mb-0"
            aria-labelledby={`docs-book-${book.key}`}
          >
            <h2
              id={`docs-book-${book.key}`}
              className="px-3 py-2 text-sm font-semibold"
              data-testid={`docs-toc-book-${book.key}`}
            >
              {book.title}
            </h2>
            <NavList>
              {tree[book.key].map((node) => (
                <TocNodeRow
                  key={node.id}
                  node={node}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                />
              ))}
            </NavList>
          </section>
        ))
      )}
    </nav>
  );
}
