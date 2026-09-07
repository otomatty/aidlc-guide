import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, it } from "vitest";
import type { DocsReadReply, DocsSearchReply } from "../../official-docs/src/retrieval-types.ts";
import { CLI, REPO_ROOT } from "./support.ts";

it("answers via bundled docs from an empty workspace and advertises automatic citation instructions", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aidlc-docs-mcp-"));
  const client = new Client({ name: "docs-smoke", version: "1" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.platform === "win32" ? "bun.exe" : "bun",
        args: [process.env.AIDLC_DOCS_SMOKE_ENTRY ?? CLI],
        cwd: root,
      }),
    );
    expect(client.getInstructions()).toContain("回答前に aidlc_docs_search");
    expect(Buffer.byteLength(client.getInstructions() ?? "")).toBeLessThan(2048);
    const response = await client.callTool({
      name: "aidlc_docs_search",
      arguments: { query: "AI-DLCとは何ですか" },
    });
    const content = response.content as { text: string }[];
    expect(content).toHaveLength(1);
    const search = JSON.parse(content[0]?.text ?? "") as DocsSearchReply;
    expect(search.results.length).toBeGreaterThan(0);
    const read = await client.callTool({
      name: "aidlc_docs_read",
      arguments: { id: search.results[0]?.id },
    });
    expect(read.isError).toBeFalsy();
    const readContent = read.content as { text: string }[];
    expect(readContent).toHaveLength(1);
    const body = JSON.parse(readContent[0]?.text ?? "") as DocsReadReply;
    expect(body.source.url).toMatch(
      /https:\/\/github.com\/awslabs\/aidlc-workflows\/blob\/[0-9a-f]{40}\//,
    );
    const manifest = JSON.parse(
      await readFile(path.join(REPO_ROOT, "docs/official-docs.manifest.json"), "utf8"),
    );
    expect(body.source.version).toBe(manifest.sourceVersion);
    expect(body.text).not.toBe("");
    const bad = await client.callTool({
      name: "aidlc_docs_read",
      arguments: { id: "../../secret" },
    });
    expect(bad.isError).toBeFalsy();
    expect((bad.content as { text: string }[])[0]?.text).toContain("not_found");
    const invalid = await client.callTool({
      name: "aidlc_docs_search",
      arguments: { query: "gate", max_tokens: 1 },
    });
    expect(invalid.isError).toBe(true);
  } finally {
    await client.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
