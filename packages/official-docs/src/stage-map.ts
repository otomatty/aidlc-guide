import type { StageDocRef } from "./types.ts";

/**
 * FR-U3.3 static map — exactly these seven slugs resolve; all others → null.
 * Paths use the DocPath convention (`guide/…` | `reference/…`).
 */
const STAGE_DOC_MAP: Readonly<Record<string, StageDocRef>> = Object.freeze({
  "intent-capture": {
    path: "guide/getting-started.md",
    anchor: "approval-gates",
  },
  feasibility: {
    path: "guide/getting-started.md",
  },
  "scope-definition": {
    path: "reference/scopes.md",
    anchor: "feature-scope",
  },
  "rough-mockups": {
    path: "guide/getting-started.md",
  },
  "reverse-engineering": {
    path: "reference/scopes.md",
  },
  "practices-discovery": {
    path: "guide/getting-started.md",
    anchor: "approval-gates",
  },
  "requirements-analysis": {
    path: "reference/scopes.md",
    anchor: "feature-scope",
  },
});

/** Synchronous lookup — no I/O (BR-OD-7 / BR-OD-9). */
export function mapStageToDoc(stageSlug: string): StageDocRef | null {
  const key = stageSlug.trim();
  if (key === "") return null;
  return STAGE_DOC_MAP[key] ?? null;
}

export const MAPPED_STAGE_SLUGS: readonly string[] = Object.freeze(Object.keys(STAGE_DOC_MAP));
