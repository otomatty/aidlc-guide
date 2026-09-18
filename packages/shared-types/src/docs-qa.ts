export type DocsQaTool = "claude" | "cursor" | "copilot";

export interface DocsQaTarget {
  kind: "official" | "guide";
  /** Locale-neutral official path, or a guides catalog filename. */
  path: string;
  locale: "en" | "ja";
}

export interface DocsQaCitation {
  /** Number used by the answer, e.g. "1" in [1]. */
  id: string;
  sourceId: string;
  target: DocsQaTarget;
  title: string;
  headings: string[];
  version: string;
  hash: string;
  startLine: number;
  endLine: number;
  quote: string;
  /** Column headings for a table-row quote; not part of the highlighted row range. */
  context?: string;
}

export interface DocsQaRequest {
  question: string;
  tool: DocsQaTool;
  locale: "en" | "ja";
  target?: DocsQaTarget;
  history?: Array<{ question: string; answer: string }>;
}

export interface DocsQaToolStatus {
  tool: DocsQaTool;
  label: string;
  available: boolean;
  detail?: string;
}

export type DocsQaPhase =
  "searching" | "reading" | "answering" | "completed" | "cancelled" | "error";

export interface DocsQaJob {
  id: string;
  question: string;
  tool: DocsQaTool;
  locale?: "en" | "ja";
  target?: DocsQaTarget;
  phase: DocsQaPhase;
  answer: string;
  citations: DocsQaCitation[];
  /** Related sources remain available when an answer could not be grounded. */
  sourcesKind?: "citations" | "related";
  error?: string;
  createdAt: number;
}

export interface DocsQaEvidence {
  target: DocsQaTarget;
  title: string;
  markdown: string;
  hash: string;
  /** False means the source changed after this answer was generated. */
  matches: boolean;
}

export type DocsQaResult<T> = { ok: true; value: T } | { error: true; reason: string };
