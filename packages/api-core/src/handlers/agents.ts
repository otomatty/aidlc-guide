import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { agentEntry, stagesForAgent } from "@aidlc-guide/docs-bridge";
import { guardPath } from "@aidlc-guide/reader-core";
import type {
  AgentDoc,
  AgentKnowledgeItem,
  MarkdownDoc,
  ReadResult,
} from "@aidlc-guide/shared-types";
import { MD_FILE, titleFromMarkdown } from "./markdown.ts";

/** Safe agent ids (no path segments). */
const AGENT_ID = /^[a-z][a-z0-9-]*$/i;

function agentsDir(workspaceRoot: string): string {
  return path.resolve(workspaceRoot, ".claude", "agents");
}

function knowledgeDir(workspaceRoot: string, agentId: string): string {
  return path.resolve(workspaceRoot, ".claude", "knowledge", agentId);
}

function parseAgentMarkdown(text: string): {
  displayName: string;
  description: string;
  markdown: string;
} {
  if (!text.startsWith("---")) {
    return { displayName: "", description: "", markdown: text.trim() };
  }
  const end = text.indexOf("\n---", 3);
  if (end < 0) {
    return { displayName: "", description: "", markdown: text.trim() };
  }

  const frontmatter = text.slice(3, end).trim();
  const body = text
    .slice(end + 4)
    .replace(/^\n/, "")
    .trim();
  let displayName = "";
  let description = "";
  const lines = frontmatter.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const displayMatch = /^display_name:\s*(.+)$/.exec(line);
    if (displayMatch?.[1] !== undefined) {
      displayName = displayMatch[1].trim();
      continue;
    }

    const descMatch = /^description:\s*(.*)$/.exec(line);
    if (descMatch === null) continue;

    let value = descMatch[1]?.trim() ?? "";
    if (value === ">" || value.startsWith(">")) {
      const parts: string[] = [];
      if (value.startsWith(">")) {
        const first = value.slice(1).trim();
        if (first !== "") parts.push(first);
      }
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1] ?? "")) {
        i++;
        parts.push((lines[i] ?? "").trim());
      }
      value = parts.join(" ");
    }
    description = value;
  }

  return { displayName, description, markdown: body };
}

async function listKnowledge(
  workspaceRoot: string,
  agentId: string,
): Promise<AgentKnowledgeItem[]> {
  const dir = knowledgeDir(workspaceRoot, agentId);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const knowledge: AgentKnowledgeItem[] = [];
  for (const name of entries.filter((entry) => MD_FILE.test(entry)).sort()) {
    const guarded = await guardPath(dir, name);
    if (!("ok" in guarded)) continue;
    try {
      const text = await readFile(guarded.value, "utf8");
      knowledge.push({ name, title: titleFromMarkdown(text, name) });
    } catch {
      // Skip unreadable files rather than failing the whole catalogue.
    }
  }
  return knowledge;
}

export async function resolveAgent(
  workspaceRoot: string,
  id: string,
): Promise<ReadResult<AgentDoc>> {
  if (!AGENT_ID.test(id)) {
    return { error: true, reason: "not-found" };
  }

  const stages = stagesForAgent(id);
  // Prefer the Japanese learner-facing map (same idea as bridge-map stage copy).
  // English `.claude/agents/*.md` personas stay the runtime source for the AI;
  // the dashboard shows the translated explanation instead.
  const localized = agentEntry(id);
  let displayName = localized?.displayName ?? id;
  let description = localized?.description ?? "";
  let markdown = localized?.markdown ?? "";

  if (localized === undefined) {
    const guarded = await guardPath(agentsDir(workspaceRoot), `${id}.md`);
    if ("ok" in guarded) {
      try {
        const text = await readFile(guarded.value, "utf8");
        const parsed = parseAgentMarkdown(text);
        displayName = parsed.displayName === "" ? id : parsed.displayName;
        description = parsed.description;
        markdown = parsed.markdown;
      } catch {
        // Persona file absent: fallback fields stay empty/id.
      }
    }
  }

  const knowledge = await listKnowledge(workspaceRoot, id);
  return {
    ok: true,
    value: { id, displayName, description, markdown, stages, knowledge },
  };
}

export async function readAgentKnowledge(
  workspaceRoot: string,
  agentId: string,
  name: string,
): Promise<ReadResult<MarkdownDoc>> {
  if (!AGENT_ID.test(agentId) || !MD_FILE.test(name)) {
    return { error: true, reason: "not-found" };
  }

  const dir = knowledgeDir(workspaceRoot, agentId);
  const guarded = await guardPath(dir, name);
  if (!("ok" in guarded)) {
    return { error: true, reason: "not-found" };
  }

  try {
    const markdown = await readFile(guarded.value, "utf8");
    return {
      ok: true,
      value: { name, title: titleFromMarkdown(markdown, name), markdown },
    };
  } catch {
    return { error: true, reason: "not-found" };
  }
}
