import type {
  ArtifactDoc,
  BridgeConfig,
  DeepLink,
  ReadResult,
  StageDoc,
  TermDoc,
} from "@aidlc-guide/shared-types";
import rawAgentMap from "../data/agent-map.json";
import rawArtifactMap from "../data/artifact-map.json";
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

/** One stage's derived artifact descriptions (scripts/build-artifact-map.ts). */
export interface ArtifactStageEntry {
  number: string;
  /** Official-docs DocPath of the phase page this was derived from. */
  docPath: string;
  /** Section anchor per locale; headings are translated, so anchors differ. */
  anchors: Record<string, string | null>;
  /** `name` | `position` — how that locale's rows were matched. Provenance. */
  join: Record<string, string>;
  /** en Outputs row order a positional pairing was made against; else null. */
  joinOrder: string[] | null;
  artifacts: Record<string, { fileName: string; descriptions: Record<string, string | null> }>;
}

export interface ArtifactMap {
  sourceVersion: string;
  generator: string;
  stages: Record<string, ArtifactStageEntry>;
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

/**
 * Derived from the bundled official-docs snapshot, never hand-edited — see
 * `scripts/build-artifact-map.ts`. Frozen for the same reason as
 * {@link bridgeMap}: consumers share the object.
 */
export const artifactMap: ArtifactMap = Object.freeze(rawArtifactMap satisfies ArtifactMap);

/**
 * Docs-lookup only. Disk slugs stay as written on the state file (v7
 * `application-design` still names `inception/application-design/`).
 * I/O lists are {@link stageIoOf}, not this alias.
 */
export const STAGE_SLUG_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "application-design": "domain-design",
});

export interface StageIo {
  inputs: readonly string[];
  outputs: readonly string[];
}

/**
 * State Version 7 slugs whose artifact names are not the current map entry.
 * `application-design` produced methods/services/dependency, not traceability.
 */
export const LEGACY_STAGE_IO: Readonly<Record<string, StageIo>> = Object.freeze({
  "application-design": {
    inputs: ["requirements", "stories", "architecture", "component-inventory", "team-practices"],
    outputs: [
      "components",
      "decisions",
      "component-methods",
      "services",
      "component-dependency",
      "application-design-questions",
    ],
  },
});

export function stageEntryOf(slug: string): StageEntry | undefined {
  if (Object.hasOwn(bridgeMap.stages, slug)) return bridgeMap.stages[slug];
  if (!Object.hasOwn(STAGE_SLUG_ALIASES, slug)) return undefined;
  const aliased = STAGE_SLUG_ALIASES[slug];
  if (aliased === undefined || !Object.hasOwn(bridgeMap.stages, aliased)) return undefined;
  return bridgeMap.stages[aliased];
}

/** Version-specific I/O. Never follows {@link STAGE_SLUG_ALIASES}. */
export function stageIoOf(slug: string): StageIo | undefined {
  if (Object.hasOwn(LEGACY_STAGE_IO, slug)) return LEGACY_STAGE_IO[slug];
  if (!Object.hasOwn(bridgeMap.stages, slug)) return undefined;
  const entry = bridgeMap.stages[slug];
  return entry === undefined ? undefined : { inputs: entry.inputs, outputs: entry.outputs };
}

/**
 * Artifact descriptions for one stage, keyed by canonical artifact name.
 * Follows {@link STAGE_SLUG_ALIASES}, so a v7 `application-design` record still
 * explains the artifacts that kept their names; the ones v7 alone produced are
 * simply absent rather than described with v8 copy.
 */
export function artifactDocsOf(slug: string): Record<string, ArtifactDoc> {
  const key = Object.hasOwn(artifactMap.stages, slug) ? slug : (STAGE_SLUG_ALIASES[slug] ?? slug);
  const entry = artifactMap.stages[key];
  return entry === undefined ? {} : artifactDocsOfEntry(entry);
}

function artifactDocsOfEntry(entry: ArtifactStageEntry): Record<string, ArtifactDoc> {
  const docs: Record<string, ArtifactDoc> = {};
  for (const [artifact, value] of Object.entries(entry.artifacts)) {
    docs[artifact] = {
      fileName: value.fileName,
      descriptions: {
        en: value.descriptions.en ?? null,
        ja: value.descriptions.ja ?? null,
      },
    };
  }
  return docs;
}

/**
 * Artifact name -> description, for names produced by exactly one stage.
 *
 * The artifact vocabulary guarantees every *consumed* name has a single
 * producer, which is what makes this index sound: it lets a card explain the
 * artifacts a stage reads, not only the ones it writes. Names several stages
 * produce (`traceability`) are ambiguous and deliberately left out — none of
 * them is consumed, so nothing is lost.
 */
let sharedIndex: Map<string, ArtifactDoc> | null = null;
let producerIndex: Map<string, string> | null = null;

export function artifactDocIndex(): ReadonlyMap<string, ArtifactDoc> {
  if (sharedIndex !== null) return sharedIndex;
  const seen = new Map<string, ArtifactDoc | null>();
  for (const stage of Object.values(artifactMap.stages)) {
    for (const [artifact, doc] of Object.entries(artifactDocsOfEntry(stage))) {
      seen.set(artifact, seen.has(artifact) ? null : doc);
    }
  }
  sharedIndex = new Map(
    [...seen].filter((pair): pair is [string, ArtifactDoc] => pair[1] !== null),
  );
  return sharedIndex;
}

/**
 * Artifact name -> the one stage that writes it, for names a single stage
 * produces. Same soundness argument as {@link artifactDocIndex}: every consumed
 * name has exactly one producer.
 *
 * Needed because a filename is not unique even when an artifact name is —
 * `test-results.md` is written by Build and Test and by Performance Validation,
 * in different phases. Anything reaching for an artifact by filename has to say
 * whose copy it means.
 */
export function artifactProducerOf(artifact: string): string | undefined {
  if (producerIndex === null) {
    const seen = new Map<string, string | null>();
    for (const [slug, stage] of Object.entries(artifactMap.stages)) {
      for (const name of Object.keys(stage.artifacts)) {
        seen.set(name, seen.has(name) ? null : slug);
      }
    }
    producerIndex = new Map([...seen].filter((pair): pair is [string, string] => pair[1] !== null));
  }
  return producerIndex.get(artifact);
}

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
  const entry = stageEntryOf(key);
  const io = stageIoOf(key);
  if (entry === undefined || io === undefined) return { error: true, reason: "not-found" };

  const deepLink = deepLinkOf(entry);
  const { excerpt, warnings } = await attachExcerpt(config, deepLink);

  const value: StageDoc = {
    slug: key,
    purpose: entry.purpose,
    inputs: [...io.inputs],
    outputs: [...io.outputs],
    agent: entry.agent,
    agentDisplayName: agentEntry(entry.agent)?.displayName ?? entry.agent,
    gateRequirement: entry.gateRequirement,
    deepLink,
    excerpt,
    // Outputs come from this stage's own section, so a v7 record is never
    // credited with artifacts introduced after it ran; inputs come from the
    // single-producer index, since another stage wrote them.
    artifactDocs: artifactDocsFor(key, io),
    sourceVersion: bridgeMap.sourceVersion,
  };
  return warnings.length > 0 ? { ok: true, value, warnings } : { ok: true, value };
}

function artifactDocsFor(slug: string, io: StageIo): Record<string, ArtifactDoc> {
  const own = artifactDocsOf(slug);
  const docs: Record<string, ArtifactDoc> = {};
  for (const artifact of io.inputs) {
    const shared = artifactDocIndex().get(artifact);
    if (shared !== undefined) docs[artifact] = shared;
  }
  for (const artifact of io.outputs) {
    const doc = own[artifact];
    if (doc !== undefined) docs[artifact] = doc;
  }
  return docs;
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
