import { createHash } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { guardPath } from "@aidlc-guide/core-utils";
import type { ReadResult } from "@aidlc-guide/shared-types";
import { setDefaultOnNone } from "./release-lookup.ts";
import { showPlainNotice } from "./user-notice.ts";

interface McpJson {
  mcpServers?: Record<string, unknown>;
}

const SERVER_KEY = "aidlc-guide";
const registrations = new Map<string, Promise<void>>();
/** Hash the original Skill body for the trailing ownership marker. */
const digest = (text: string) => createHash("sha256").update(text).digest("hex");

/** A checksum proves the installed Skill has not been edited since registration. */
function ownedSkill(existing: string, source: string): boolean {
  if (existing === source) return true;
  const marker = /\n<!-- aidlc-guide-managed:([0-9a-f]{64}) -->\n$/.exec(existing);
  return marker !== null && digest(existing.slice(0, marker.index)) === marker[1];
}

/** Check existing ancestors too: a new file beneath a junction has no realpath yet. */
async function guardRegistrationPath(root: string, rel: string): Promise<ReadResult<string>> {
  const parts = rel.split("/");
  for (let count = 1; count < parts.length; count++) {
    const parent = await guardPath(root, parts.slice(0, count).join("/"));
    if (!("ok" in parent)) return parent;
  }
  return guardPath(root, rel);
}

/** Explicit registration writes both clients when a Skill is supplied; custom Skills are refused. */
export async function registerMcp(
  workspaceRoot: string,
  mcpScriptPath: string,
  skillSourcePath?: string,
  isCurrent: () => boolean = () => true,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const previous = registrations.get(workspaceRoot);
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  registrations.set(workspaceRoot, pending);
  try {
    await previous;
    if (!isCurrent()) return { ok: false, reason: "registration-cancelled" };
    return await registerFiles(workspaceRoot, mcpScriptPath, skillSourcePath, isCurrent);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown";
    return { ok: false, reason: `registration-io-error:${code}` };
  } finally {
    release();
    if (registrations.get(workspaceRoot) === pending) registrations.delete(workspaceRoot);
  }
}

/** Preflight every destination and Skill before writing configs, preserving unrelated server entries. */
async function registerFiles(
  workspaceRoot: string,
  mcpScriptPath: string,
  skillSourcePath?: string,
  isCurrent: () => boolean = () => true,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const configs: { target: string; value: McpJson; before: string | null }[] = [];
  for (const rel of skillSourcePath === undefined
    ? [".mcp.json"]
    : [".mcp.json", ".cursor/mcp.json"]) {
    const guarded = await guardRegistrationPath(workspaceRoot, rel);
    if (!("ok" in guarded)) return { ok: false, reason: "mcp-path-outside-workspace" };
    let raw = "{}";
    let before: string | null = null;
    try {
      raw = await readFile(guarded.value, "utf8");
      before = raw;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        return { ok: false, reason: "mcp-config-unreadable" };
    }
    let parsed: McpJson;
    try {
      parsed = JSON.parse(raw) as McpJson;
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        (parsed.mcpServers !== undefined &&
          (parsed.mcpServers === null ||
            typeof parsed.mcpServers !== "object" ||
            Array.isArray(parsed.mcpServers)))
      )
        return { ok: false, reason: "invalid-mcp-json" };
    } catch {
      return { ok: false, reason: "invalid-mcp-json" };
    }
    parsed.mcpServers ??= {};
    parsed.mcpServers[SERVER_KEY] = {
      command: "bun",
      args: ["run", mcpScriptPath.replace(/\\/g, "/")],
      cwd: workspaceRoot.replace(/\\/g, "/"),
    };
    configs.push({ target: guarded.value, value: parsed, before });
  }

  // Keep custom skills intact. A checksum identifies an unmodified copy we own.
  const installs: { target: string; text: string; before: string | null }[] = [];
  if (skillSourcePath !== undefined) {
    const source = await readFile(skillSourcePath, "utf8");
    const text = `${source}\n<!-- aidlc-guide-managed:${digest(source)} -->\n`;
    for (const harness of [".claude", ".cursor"]) {
      const rel = `${harness}/skills/aidlc-guide-docs/SKILL.md`;
      const guarded = await guardRegistrationPath(workspaceRoot, rel);
      if (!("ok" in guarded)) return { ok: false, reason: "docs-skill-outside-workspace" };
      const existing = await readFile(guarded.value, "utf8").catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (existing !== null && !ownedSkill(existing, source))
        return { ok: false, reason: `custom-docs-skill-exists:${rel}` };
      installs.push({ target: guarded.value, text, before: existing });
    }
  }

  const edits = [
    ...configs.map(({ target, value, before }) => ({
      target,
      before,
      text: `${JSON.stringify(value, null, 2)}\n`,
    })),
    ...installs,
  ];
  const applied: typeof edits = [];
  try {
    for (const edit of edits) {
      if (!isCurrent()) throw new Error("registration-cancelled");
      await mkdir(path.dirname(edit.target), { recursive: true });
      const guarded = await guardRegistrationPath(
        workspaceRoot,
        path.relative(workspaceRoot, edit.target).split(path.sep).join("/"),
      );
      if (!("ok" in guarded)) throw new Error("registration-path-changed");
      if (!isCurrent()) throw new Error("registration-cancelled");
      // Compare and write in one event-loop turn; a changed preflight snapshot is never overwritten.
      if (readOptional(edit.target) !== edit.before) throw new Error("registration-file-changed");
      applied.push(edit);
      writeFileSync(edit.target, edit.text, "utf8");
    }
    if (!isCurrent()) throw new Error("registration-cancelled");
    return { ok: true };
  } catch (error) {
    const conflicts: string[] = [];
    for (const edit of applied.reverse()) {
      const rel = path.relative(workspaceRoot, edit.target).split(path.sep).join("/");
      try {
        const guarded = await guardRegistrationPath(workspaceRoot, rel);
        if (!("ok" in guarded) || readOptional(edit.target) !== edit.text) {
          conflicts.push(rel);
          continue;
        }
        if (edit.before === null) unlinkSync(edit.target);
        else writeFileSync(edit.target, edit.before, "utf8");
      } catch {
        conflicts.push(rel);
      }
    }
    return {
      ok: false,
      reason: `${error instanceof Error ? error.message : "registration-failed"}${conflicts.length ? `; rollback-conflict:${conflicts.join(",")}` : ""}`,
    };
  }
}

function readOptional(file: string): string | null {
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Check only the legacy Claude MCP entry; full setup readiness uses refreshDocsRegistration. */
export async function isMcpRegistered(workspaceRoot: string): Promise<boolean> {
  try {
    const raw = await readFile(path.join(workspaceRoot, ".mcp.json"), "utf8");
    const parsed = JSON.parse(raw) as McpJson;
    return parsed.mcpServers?.[SERVER_KEY] !== undefined;
  } catch {
    return false;
  }
}

/** Match only the generated entry, including cwd and absence of custom options. */
function generatedEntry(
  entry: unknown,
  root: string,
): entry is { command: string; args: [string, string]; cwd: string } {
  if (entry === null || typeof entry !== "object") return false;
  const value = entry as Record<string, unknown>;
  return (
    Object.keys(value).sort().join(",") === "args,command,cwd" &&
    value.command === "bun" &&
    value.cwd === root.replace(/\\/g, "/") &&
    Array.isArray(value.args) &&
    value.args.length === 2 &&
    value.args[0] === "run" &&
    typeof value.args[1] === "string"
  );
}

/** Recognize a prior version in the same extension installation directory, never arbitrary scripts. */
function priorBundle(previous: string, current: string): boolean {
  const oldPath = previous.replace(/\\/g, "/");
  const newPath = current.replace(/\\/g, "/");
  const pattern = /^(.*\/)(aidlc\.aidlc-guide-\d+\.\d+\.\d+(?:-[\w.-]+)?)\/dist\/aidlc-mcp\.mjs$/;
  const oldMatch = pattern.exec(oldPath);
  const newMatch = pattern.exec(newPath);
  return oldMatch !== null && newMatch !== null && oldMatch[1] === newMatch[1];
}

/** Inspect actual files on every activation; refresh existing generated files only.
 * Missing or customized files need explicit registration, regardless of the legacy setupDone flag.
 */
export async function refreshDocsRegistration(
  workspaceRoot: string,
  script: string,
  skillSourcePath: string,
  refresh = true,
): Promise<{ complete: boolean; updated: boolean; reason?: string }> {
  let complete = true;
  let updated = false;
  try {
    const source = await readFile(skillSourcePath, "utf8");
    for (const rel of [
      ".mcp.json",
      ".cursor/mcp.json",
      ".claude/skills/aidlc-guide-docs/SKILL.md",
      ".cursor/skills/aidlc-guide-docs/SKILL.md",
    ]) {
      const guarded = await guardRegistrationPath(workspaceRoot, rel);
      if (!("ok" in guarded)) {
        complete = false;
        continue;
      }
      const existing = await readFile(guarded.value, "utf8").catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (existing === null) {
        complete = false;
        continue;
      }
      let replacement: string | undefined;
      if (rel.endsWith("SKILL.md")) {
        if (!ownedSkill(existing, source)) {
          complete = false;
          continue;
        }
        const expected = `${source}\n<!-- aidlc-guide-managed:${digest(source)} -->\n`;
        if (existing !== expected) replacement = expected;
      } else {
        const config = JSON.parse(existing) as McpJson | null;
        const entry = config?.mcpServers?.[SERVER_KEY];
        if (!generatedEntry(entry, workspaceRoot)) {
          complete = false;
          continue;
        }
        const current = script.replace(/\\/g, "/");
        if (entry.args[1] !== current) {
          if (!priorBundle(entry.args[1], current)) {
            complete = false;
            continue;
          }
          entry.args[1] = current;
          replacement = `${JSON.stringify(config, null, 2)}\n`;
        }
      }
      if (replacement !== undefined) {
        if (!refresh) {
          complete = false;
          continue;
        }
        await writeFile(guarded.value, replacement, "utf8");
        updated = true;
      }
    }
    return { complete, updated };
  } catch (error) {
    return {
      complete: false,
      updated,
      reason: error instanceof Error ? error.message : "registration-unreadable",
    };
  }
}

/** Prefer the installed standalone bundle, falling back to sibling sources in development. */
export function mcpScriptPath(extensionPath: string): string {
  const bundled = path.join(extensionPath, "dist", "aidlc-mcp.mjs");
  return existsSync(bundled)
    ? bundled
    : path.join(extensionPath, "..", "mcp-server", "src", "index.ts");
}

/** Locate the packaged Skill copy or its development source for client registration. */
export function docsSkillPath(extensionPath: string): string {
  const bundled = path.join(extensionPath, "media", "aidlc-guide-docs", "SKILL.md");
  return existsSync(bundled)
    ? bundled
    : path.join(extensionPath, "..", "mcp-server", "skills", "aidlc-guide-docs", "SKILL.md");
}

/** Resolve the sibling BTW source CLI used by development commands. */
export function btwCliPath(extensionPath: string): string {
  return path.join(extensionPath, "..", "btw", "src", "cli.ts");
}

export {
  registerApplyLatestCommand,
  registerApplyLatestCommand as ensureHostCommands,
} from "./write-global-vsix.ts";

setDefaultOnNone(async () => {
  showPlainNotice("Up to date.");
});
