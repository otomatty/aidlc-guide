import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
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

/** Check existing ancestors too: a new file beneath a junction has no realpath yet. */
async function guardRegistrationPath(root: string, rel: string): Promise<ReadResult<string>> {
  const parts = rel.split("/");
  for (let count = 1; count < parts.length; count++) {
    const parent = await guardPath(root, parts.slice(0, count).join("/"));
    if (!("ok" in parent)) return parent;
  }
  return guardPath(root, rel);
}

export async function registerMcp(
  workspaceRoot: string,
  mcpScriptPath: string,
  skillSourcePath?: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    return await registerFiles(workspaceRoot, mcpScriptPath, skillSourcePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown";
    return { ok: false, reason: `registration-io-error:${code}` };
  }
}

async function registerFiles(
  workspaceRoot: string,
  mcpScriptPath: string,
  skillSourcePath?: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const configs: { target: string; value: McpJson }[] = [];
  for (const rel of skillSourcePath === undefined
    ? [".mcp.json"]
    : [".mcp.json", ".cursor/mcp.json"]) {
    const guarded = await guardRegistrationPath(workspaceRoot, rel);
    if (!("ok" in guarded)) return { ok: false, reason: "mcp-path-outside-workspace" };
    let raw = "{}";
    try {
      raw = await readFile(guarded.value, "utf8");
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
    configs.push({ target: guarded.value, value: parsed });
  }

  // Keep custom skills intact. A checksum identifies an unmodified copy we own.
  const installs: { target: string; text: string }[] = [];
  if (skillSourcePath !== undefined) {
    const source = await readFile(skillSourcePath, "utf8");
    const digest = (text: string) => createHash("sha256").update(text).digest("hex");
    const text = `${source}\n<!-- aidlc-guide-managed:${digest(source)} -->\n`;
    for (const harness of [".claude", ".cursor"]) {
      const rel = `${harness}/skills/aidlc-guide-docs/SKILL.md`;
      const guarded = await guardRegistrationPath(workspaceRoot, rel);
      if (!("ok" in guarded)) return { ok: false, reason: "docs-skill-outside-workspace" };
      const existing = await readFile(guarded.value, "utf8").catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (existing !== null && existing !== text && existing !== source) {
        const marker = /\n<!-- aidlc-guide-managed:([0-9a-f]{64}) -->\n$/.exec(existing);
        if (!marker || digest(existing.slice(0, marker.index)) !== marker[1])
          return { ok: false, reason: `custom-docs-skill-exists:${rel}` };
      }
      installs.push({ target: guarded.value, text });
    }
  }

  for (const config of configs) {
    await mkdir(path.dirname(config.target), { recursive: true });
    await writeFile(config.target, `${JSON.stringify(config.value, null, 2)}\n`, "utf8");
  }
  for (const install of installs) {
    await mkdir(path.dirname(install.target), { recursive: true });
    await writeFile(install.target, install.text, "utf8");
  }
  return { ok: true };
}

export async function isMcpRegistered(workspaceRoot: string): Promise<boolean> {
  try {
    const raw = await readFile(path.join(workspaceRoot, ".mcp.json"), "utf8");
    const parsed = JSON.parse(raw) as McpJson;
    return parsed.mcpServers?.[SERVER_KEY] !== undefined;
  } catch {
    return false;
  }
}

export function mcpScriptPath(extensionPath: string): string {
  const bundled = path.join(extensionPath, "dist", "aidlc-mcp.mjs");
  return existsSync(bundled)
    ? bundled
    : path.join(extensionPath, "..", "mcp-server", "src", "index.ts");
}

export function docsSkillPath(extensionPath: string): string {
  const bundled = path.join(extensionPath, "media", "aidlc-guide-docs", "SKILL.md");
  return existsSync(bundled)
    ? bundled
    : path.join(extensionPath, "..", "mcp-server", "skills", "aidlc-guide-docs", "SKILL.md");
}

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
