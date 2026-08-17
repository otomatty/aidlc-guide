import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface McpJson {
  mcpServers?: Record<string, unknown>;
}

const SERVER_KEY = "aidlc-guide";

export async function registerMcp(
  workspaceRoot: string,
  mcpScriptPath: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const configPath = path.join(workspaceRoot, ".mcp.json");
  let raw = "{}";
  try {
    raw = await readFile(configPath, "utf8");
  } catch {
    // new file
  }

  let parsed: McpJson;
  try {
    parsed = JSON.parse(raw) as McpJson;
  } catch {
    return { ok: false, reason: "invalid-mcp-json" };
  }

  if (parsed.mcpServers === undefined) parsed.mcpServers = {};

  parsed.mcpServers[SERVER_KEY] = {
    command: "bun",
    args: ["run", mcpScriptPath.replace(/\\/g, "/")],
    cwd: workspaceRoot.replace(/\\/g, "/"),
  };

  await writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
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
  return path.join(extensionPath, "..", "mcp-server", "src", "index.ts");
}

export function btwCliPath(extensionPath: string): string {
  return path.join(extensionPath, "..", "btw", "src", "cli.ts");
}

export {
  registerApplyLatestCommand,
  registerApplyLatestCommand as ensureHostCommands,
} from "./write-global-vsix.ts";
