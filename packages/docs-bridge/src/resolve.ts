import type {
  BridgeConfig,
  DeepLink,
  ReadResult,
  StageDoc,
  TermDoc,
} from "@aidlc-guide/shared-types";
import rawAgentMap from "../data/agent-map.json";
import rawMap from "../data/bridge-map.json";
import { readExcerpt } from "./excerpt.ts";

export interface StageEntry {
  purpose: string;
  inputs: string[];
  outputs: string[];
  agent: string;
  gateRequirement: string;
  docPath: string;
  docAnchor: string;
}

export interface TermEntry {
  definition: string;
  docPath: string;
  docAnchor: string;
}

export interface BridgeMap {
  sourceVersion: string;
  stages: Record<string, StageEntry>;
  terms: Record<string, TermEntry>;
}

/** Learner-facing Japanese copy for agent personas (UI / MCP explain). */
export interface AgentEntry {
  displayName: string;
  description: string;
  markdown: string;
}

export interface AgentMap {
  sourceVersion: string;
  agents: Record<string, AgentEntry>;
}

/**
 * The single source of the mapping (BR-DB-1). Imported statically, so a
 * malformed or shape-drifted map is a build failure, not a runtime one
 * (R-DB-1) — the `BridgeMap` annotation is the type check that enforces it.
 *
 * Frozen for R-DB-3: consumers share this object, and a mutation by one would
 * silently change what the other reads.
 */
export const bridgeMap: BridgeMap = Object.freeze(rawMap satisfies BridgeMap);

export const agentMap: AgentMap = Object.freeze(rawAgentMap satisfies AgentMap);

/** Terms are looked up case- and whitespace-insensitively (D3 step 1). */
export function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

/** Stage slugs whose bridge-map entry names the given lead agent. */
export function stagesForAgent(agentId: string): string[] {
  return Object.entries(bridgeMap.stages)
    .filter(([, entry]) => entry.agent === agentId)
    .map(([slug]) => slug)
    .sort((a, b) => a.localeCompare(b));
}

/** Japanese learner-facing entry for an agent id, if one exists. */
export function agentEntry(agentId: string): AgentEntry | undefined {
  return agentMap.agents[agentId];
}

function deepLinkOf(entry: { docPath: string; docAnchor: string }): DeepLink | null {
  return entry.docPath === "" ? null : { docPath: entry.docPath, docAnchor: entry.docAnchor };
}

/** Shared tail of D2/D3: attach the verbatim excerpt when docs are available. */
async function attachExcerpt(
  config: BridgeConfig,
  deepLink: DeepLink | null,
): Promise<{ excerpt: string | null; warnings: string[] }> {
  if (config.docsRepoPath === null || deepLink === null) return { excerpt: null, warnings: [] };
  const result = await readExcerpt(config.docsRepoPath, deepLink.docPath, deepLink.docAnchor);
  return {
    excerpt: result.excerpt,
    warnings: result.warning === undefined ? [] : [result.warning],
  };
}

/**
 * D2 — the explanation of one stage (US-03 ①-④ + deep link).
 *
 * Pure with respect to config: it is passed in, never loaded here
 * (nfr-design/logical-components.md). Unknown slug is `not-found`; missing docs
 * are *not* an error — the static entry is the value, the excerpt is a bonus.
 */
export async function resolveStage(
  config: BridgeConfig,
  slug: string,
): Promise<ReadResult<StageDoc>> {
  const key = slug.trim();
  const entry = bridgeMap.stages[key];
  if (entry === undefined) return { error: true, reason: "not-found" };

  const deepLink = deepLinkOf(entry);
  const { excerpt, warnings } = await attachExcerpt(config, deepLink);

  const value: StageDoc = {
    slug: key,
    purpose: entry.purpose,
    inputs: entry.inputs,
    outputs: entry.outputs,
    agent: entry.agent,
    agentDisplayName: agentEntry(entry.agent)?.displayName ?? entry.agent,
    gateRequirement: entry.gateRequirement,
    deepLink,
    excerpt,
    sourceVersion: bridgeMap.sourceVersion,
  };
  return warnings.length > 0 ? { ok: true, value, warnings } : { ok: true, value };
}

/** D3 — a glossary entry (US-04). Same degradation ladder as {@link resolveStage}. */
export async function resolveTerm(
  config: BridgeConfig,
  term: string,
): Promise<ReadResult<TermDoc>> {
  const key = normalizeTerm(term);
  const entry = bridgeMap.terms[key];
  if (entry === undefined) return { error: true, reason: "undefined-term" };

  const deepLink = deepLinkOf(entry);
  const { excerpt, warnings } = await attachExcerpt(config, deepLink);

  const value: TermDoc = {
    term: key,
    definition: entry.definition,
    deepLink,
    excerpt,
    sourceVersion: bridgeMap.sourceVersion,
  };
  return warnings.length > 0 ? { ok: true, value, warnings } : { ok: true, value };
}
