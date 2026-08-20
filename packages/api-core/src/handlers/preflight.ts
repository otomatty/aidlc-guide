import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  PreflightPlan,
  PreflightScopeSummary,
  PreflightStage,
} from "@aidlc-guide/shared-types";

/**
 * /api/preflight の静的部分 — `.claude/` の固定 3 種（stage-graph.json /
 * scope-grid.json / scopes/*.md frontmatter）だけを読む。ユーザー入力を
 * パスに使う経路は無い（S: guardPath 新経路なし）。
 */

interface GraphNode {
  slug: string;
  number: string;
  name: string;
  phase: string;
  lead_agent: string;
  produces: string[];
}

type Grid = Record<string, { stages: Record<string, string> }>;

function dataPath(root: string, file: string): string {
  return path.join(root, ".claude", "tools", "data", file);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function loadGraph(root: string): Promise<GraphNode[] | null> {
  const raw = await readJson<Record<string, GraphNode>>(dataPath(root, "stage-graph.json"));
  if (raw === null) return null;
  return Object.keys(raw)
    .map((k) => Number(k))
    .filter((k) => Number.isInteger(k))
    .sort((a, b) => a - b)
    .map((k) => raw[String(k)])
    .filter((n): n is GraphNode => n !== undefined);
}

export function parseScopeFrontmatter(
  text: string,
): { name: string; depth: string; skeleton: string; description: string } | null {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const fields: Record<string, string> = {};
  for (const line of text.slice(3, end).split(/\r?\n/)) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    fields[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  if (fields.name === undefined) return null;
  return {
    name: fields.name,
    depth: fields.depth ?? "",
    skeleton: fields.skeleton ?? "",
    description: fields.description ?? "",
  };
}

function countsFor(
  graph: GraphNode[],
  stages: Record<string, string>,
): { executeCount: number; totalCount: number; gateCount: number } {
  let executeCount = 0;
  let gateCount = 0;
  for (const node of graph) {
    if (stages[node.slug] !== "EXECUTE") continue;
    executeCount += 1;
    if (node.phase !== "initialization") gateCount += 1;
  }
  return { executeCount, totalCount: graph.length, gateCount };
}

export async function buildCatalog(
  root: string,
): Promise<{ scopes: PreflightScopeSummary[]; errors: string[] }> {
  const graph = await loadGraph(root);
  const grid = await readJson<Grid>(dataPath(root, "scope-grid.json"));
  if (graph === null || grid === null) {
    return { scopes: [], errors: ["framework-not-found"] };
  }

  const scopesDir = path.join(root, ".claude", "scopes");
  let files: string[];
  try {
    files = (await readdir(scopesDir)).filter(
      (f) => f.startsWith("aidlc-") && f.endsWith(".md"),
    );
  } catch {
    return { scopes: [], errors: ["framework-not-found"] };
  }

  const scopes: PreflightScopeSummary[] = [];
  for (const file of files.sort()) {
    let front: ReturnType<typeof parseScopeFrontmatter>;
    try {
      front = parseScopeFrontmatter(await readFile(path.join(scopesDir, file), "utf8"));
    } catch {
      continue;
    }
    if (front === null) continue;
    // grid にエントリの無い scope（composed 等）は all-SKIP として数える。
    const stages = grid[front.name]?.stages ?? {};
    scopes.push({ ...front, ...countsFor(graph, stages) });
  }
  return { scopes, errors: [] };
}

export async function buildPlan(root: string, scopeName: string): Promise<PreflightPlan | null> {
  const graph = await loadGraph(root);
  const grid = await readJson<Grid>(dataPath(root, "scope-grid.json"));
  const entry = grid?.[scopeName];
  if (graph === null || entry === undefined) return null;

  let front: ReturnType<typeof parseScopeFrontmatter> = null;
  try {
    front = parseScopeFrontmatter(
      await readFile(path.join(root, ".claude", "scopes", `aidlc-${scopeName}.md`), "utf8"),
    );
  } catch {
    // frontmatter 無しでもプランは出せる（depth/skeleton が空になるだけ）。
  }

  const phases: Array<{ phase: string; stages: PreflightStage[] }> = [];
  for (const node of graph) {
    const decision = entry.stages[node.slug] === "EXECUTE" ? "EXECUTE" : "SKIP";
    const stage: PreflightStage = {
      slug: node.slug,
      number: node.number,
      name: node.name,
      phase: node.phase,
      decision,
      leadAgent: node.lead_agent,
      gate: decision === "EXECUTE" && node.phase !== "initialization",
      produces: node.produces ?? [],
    };
    const bucket = phases.at(-1);
    if (bucket !== undefined && bucket.phase === node.phase) {
      bucket.stages.push(stage);
    } else {
      phases.push({ phase: node.phase, stages: [stage] });
    }
  }

  return {
    scope: scopeName,
    depth: front?.depth ?? "",
    skeleton: front?.skeleton ?? "",
    ...countsFor(graph, entry.stages),
    phases,
  };
}
