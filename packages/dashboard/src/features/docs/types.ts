export type DocsCategory = "workflow" | "extension";

export type DocSelection = { kind: "official"; path: string } | { kind: "guide"; name: string };

export interface TocEntry {
  id: string;
  title: string;
  path: string;
}

export type AnchorApplied = "scrolled" | "top" | "none";
