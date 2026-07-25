#!/usr/bin/env bun
import { createBridge } from "@aidlc-guide/docs-bridge";
import { createReader, resolveRecordDir } from "@aidlc-guide/reader-core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { type ToolReply, toContent } from "./render.ts";
import { safeHandler } from "./safe.ts";
import { EXPLAIN_STAGE_DESCRIPTION, explainStage } from "./tools/explain-stage.ts";
import { GLOSSARY_DESCRIPTION, glossary } from "./tools/glossary.ts";
import { NEXT_STEPS_DESCRIPTION, nextSteps } from "./tools/next-steps.ts";
import { READ_ARTIFACT_DESCRIPTION, readArtifact } from "./tools/read-artifact.ts";
import { STATUS_DESCRIPTION, status } from "./tools/status.ts";

/**
 * The stdio MCP server (S-MS-3 — this file names the only transport this
 * package knows; there is no HTTP/SSE code path to disable).
 *
 * Startup touches no filesystem: `createReader` re-resolves the record on every
 * call and `createBridge` loads its config lazily, so an uninitialised
 * workspace still yields a *running* server whose tools explain the situation
 * (R-MS-3), rather than a spawn failure Claude Code reports as a broken
 * integration.
 */

/** stdout is the JSON-RPC channel — a stray write there corrupts the protocol. */
function log(message: string): void {
  process.stderr.write(`aidlc-mcp: ${message}\n`);
}

function main(): Promise<void> {
  // Claude Code spawns MCP servers with cwd = project root (business-logic-model.md).
  const workspaceRoot = process.cwd();
  const reader = createReader(workspaceRoot);
  const bridge = createBridge();
  const recordDir = () => resolveRecordDir(workspaceRoot);

  const safe = <A extends unknown[]>(fn: (...args: A) => Promise<ToolReply>) =>
    safeHandler(workspaceRoot, fn);

  const server = new McpServer({ name: "aidlc-guide", version: "0.1.0" });

  server.registerTool(
    "aidlc_status",
    { title: "AI-DLC 現在地", description: STATUS_DESCRIPTION },
    async () => toContent(await safe(status)(reader, workspaceRoot)),
  );

  server.registerTool(
    "aidlc_next_steps",
    { title: "AI-DLC 次の一手", description: NEXT_STEPS_DESCRIPTION },
    async () => toContent(await safe(nextSteps)(reader, workspaceRoot)),
  );

  server.registerTool(
    "aidlc_explain_stage",
    {
      title: "AI-DLC ステージ解説",
      description: EXPLAIN_STAGE_DESCRIPTION,
      inputSchema: {
        slug: z.string().min(1).describe("ステージ slug（例: requirements-analysis）"),
      },
    },
    async ({ slug }) => toContent(await safe(explainStage)(bridge, workspaceRoot, slug)),
  );

  server.registerTool(
    "aidlc_read_artifact",
    {
      title: "AI-DLC 成果物の読取",
      description: READ_ARTIFACT_DESCRIPTION,
      inputSchema: {
        path: z.string().min(1).describe("記録ディレクトリからの相対パス"),
      },
    },
    async ({ path: relPath }) =>
      toContent(await safe(readArtifact)(reader, workspaceRoot, recordDir, relPath)),
  );

  server.registerTool(
    "aidlc_glossary",
    {
      title: "AI-DLC 用語集",
      description: GLOSSARY_DESCRIPTION,
      inputSchema: { term: z.string().min(1).describe("引きたい用語（英語 slug / 日本語）") },
    },
    async ({ term }) => toContent(await safe(glossary)(bridge, workspaceRoot, term)),
  );

  return server.connect(new StdioServerTransport());
}

// R-MS-1 layer 2. `safeHandler` covers the handlers; these cover everything
// else (a rejection from the SDK's own plumbing, a late timer). Registering an
// `uncaughtException` listener also suppresses Node's default exit — which is
// the point: losing the process loses all five tools for the rest of the
// session (BR-MS-5). Log and keep serving.
process.on("unhandledRejection", (reason) => {
  log(`unhandledRejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});
process.on("uncaughtException", (error: unknown) => {
  log(`uncaughtException: ${error instanceof Error ? error.message : String(error)}`);
});

try {
  await main();
} catch (error) {
  // Only the initial connect can land here. If stdio never came up there is no
  // channel to report on, so failing loudly beats a silent zombie process.
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
