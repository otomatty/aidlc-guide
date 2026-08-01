import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CLI, REPO_ROOT } from "./support.ts";

/**
 * End-to-end over a **real** stdio transport against a spawned Bun process.
 *
 * `src/index.ts` is a bin whose module body connects the transport, so it
 * cannot be imported into this process — and Vitest runs under Node here.
 * A real MCP client driving a real child is therefore the only way to cover
 * the wiring (tool registration, descriptions, the zod schema layer), which is
 * why index.ts is excluded from coverage the same way dashboard-server's
 * server.ts/cli.ts are.
 *
 * cwd is the repo root, so this also exercises the live record — read-only
 * (NFR-1): every tool called here is a read.
 */

const BUN = process.platform === "win32" ? "bun.exe" : "bun";
const TIMEOUT = 30_000;

let client: Client;

beforeAll(async () => {
  client = new Client({ name: "smoke", version: "0.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: BUN,
      args: [CLI],
      cwd: REPO_ROOT,
      // Windows spawn does not always inherit the parent env; forward it so
      // AIDLC_ACTIVE_INTENT (CI multi-intent pin) reaches the child server.
      env: { ...process.env },
    }),
  );
}, TIMEOUT);

afterAll(async () => {
  await client.close();
});

/** Flattened text of a tool result. Typed loosely because the SDK's result is a
 * back-compat union whose non-`content` arm this server never produces. */
function textOf(result: unknown): string {
  const blocks = (result as { content?: { text?: string }[] }).content;
  return blocks?.map((block) => block.text ?? "").join("\n") ?? "";
}

describe("mcp-server over real stdio", () => {
  it("registers exactly the five read-only tools, each saying when to use it", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "aidlc_explain_stage",
      "aidlc_glossary",
      "aidlc_next_steps",
      "aidlc_read_artifact",
      "aidlc_status",
    ]);
    // BR-MS-6 規約: the description tells the AI *when* to reach for the tool.
    for (const tool of tools) expect(tool.description ?? "").toMatch(/ときに使う|呼ぶ/);
  });

  it("aidlc_status reports the live workflow position", async () => {
    const result = await client.callTool({ name: "aidlc_status", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain("フェーズ:");
  });

  it("aidlc_next_steps answers without an argument", async () => {
    const result = await client.callTool({ name: "aidlc_next_steps", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toMatch(/次のステージ|ワークフロー完了/);
  });

  it("aidlc_explain_stage returns the static fields for a real slug", async () => {
    const result = await client.callTool({
      name: "aidlc_explain_stage",
      arguments: { slug: "code-generation" },
    });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain("担当エージェント:");
  });

  it("aidlc_glossary answers 未定義 for an unknown term as a NORMAL reply", async () => {
    const result = await client.callTool({
      name: "aidlc_glossary",
      arguments: { term: "definitely-not-a-term" },
    });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain("未定義");
  });

  it("aidlc_read_artifact refuses a traversal as a NORMAL reply, not a protocol error", async () => {
    const result = await client.callTool({
      name: "aidlc_read_artifact",
      arguments: { path: "../../../../etc/passwd" },
    });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain("記録ディレクトリの外は読めません");
  });

  it("isError is reserved for schema violations — the one protocol-error path", async () => {
    const missing = await client.callTool({ name: "aidlc_explain_stage", arguments: {} });
    expect(missing.isError).toBe(true);
    const empty = await client.callTool({
      name: "aidlc_read_artifact",
      arguments: { path: "" },
    });
    expect(empty.isError).toBe(true);
  });
});
