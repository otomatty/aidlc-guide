import type { Locale } from "./types.ts";

export const DOCS_INDEX_REL = "docs/official-docs.index.json";
export const TRANSLATIONS_REL = "docs/official-docs.translations.json";
export const INDEX_VERSION = 1;

export interface IndexedSection {
  id: string;
  anchor: string;
  headings: string[];
  startLine: number;
  endLine: number;
  parentId?: string;
  tableHeaderStart?: number;
  text: string;
}

export interface IndexedPage {
  path: string;
  locale: Locale;
  title: string;
  hash: string;
  kind: "documentation" | "proposal" | "research" | "local-guide";
  translation: "original" | "verified" | "unverified" | "stale";
  sections: IndexedSection[];
}

export interface DocsIndex {
  schemaVersion: typeof INDEX_VERSION;
  sourceVersion: string;
  upstreamSha: string;
  manifestHash: string;
  pages: IndexedPage[];
}

/** A reviewer records BOTH hashes after checking a translation against its original. */
export type TranslationApprovals = Record<string, { enHash: string; jaHash: string }>;

export interface DocsSearchInput {
  query: string;
  locale?: Locale;
  limit?: number;
  max_tokens?: number;
  include_non_normative?: boolean;
}

export interface DocsReadInput {
  id: string;
  max_tokens?: number;
  cursor?: number;
  mode?: "section" | "outline";
}

export type DocsFailure = { error: true; reason: string; message: string };

export interface DocsHit {
  id: string;
  path: string;
  headings: string[];
  locale: Locale;
  snippet: string;
  kind: IndexedPage["kind"];
}

export interface DocsSearchReply {
  sourceVersion: string;
  localeRequested: Locale;
  results: DocsHit[];
  truncated: boolean;
  estimatedTokens: number;
  next: string;
}

export interface DocsReadReply {
  source: {
    title: string;
    headings: string[];
    path: string;
    locale: Locale;
    version: string;
    hash: string;
    upstreamSha: string;
    url: string;
    kind: IndexedPage["kind"];
    lines: [number, number];
    contextLines?: [number, number];
  };
  text: string;
  children: { id: string; heading: string }[];
  hasChildren: boolean;
  truncated: boolean;
  nextCursor?: number;
  requiredTokens?: number;
  estimatedTokens: number;
}
