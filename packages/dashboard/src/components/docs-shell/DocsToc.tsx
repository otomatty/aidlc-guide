import type { OfficialDocsToc, OfficialDocsTocNode } from "@aidlc-guide/shared-types";
import type { ReactNode } from "react";
import { NavList, NavListButton } from "../NavList.tsx";

export interface TocEntry {
  id: string;
  title: string;
  path: string;
}

export function flattenToc(tree: OfficialDocsToc): TocEntry[] {
  const out: TocEntry[] = [];
  const walk = (nodes: readonly OfficialDocsTocNode[]): void => {
    for (const node of nodes) {
      out.push({ id: node.id, title: node.title, path: node.path });
      walk(node.children);
    }
  };
  walk(tree.guide);
  walk(tree.reference);
  return out;
}

export interface DocsTocProps {
  entries: readonly TocEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

/** Flat TOC nav for the walking-skeleton Docs Shell. */
export function DocsToc({ entries, selectedPath, onSelect }: DocsTocProps): ReactNode {
  return (
    <nav
      className="min-w-0 shrink-0 border-b pb-3 md:w-56 md:border-b-0 md:border-r md:pr-3 md:pb-0"
      aria-label="Official docs"
      data-testid="docs-toc"
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents.</p>
      ) : (
        <NavList>
          {entries.map((entry) => (
            <li key={entry.id}>
              <NavListButton
                data-active={entry.path === selectedPath}
                data-testid={`docs-toc-${entry.path}`}
                onClick={() => {
                  onSelect(entry.path);
                }}
              >
                {entry.title}
              </NavListButton>
            </li>
          ))}
        </NavList>
      )}
    </nav>
  );
}
