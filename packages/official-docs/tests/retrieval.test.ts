import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseTranslationApprovals,
  regenerateDocsIndex,
} from "../../../scripts/build-docs-index.ts";
import { runDocsCli } from "../src/cli.ts";
import { createDocsLibrary, serializeDocsReply } from "../src/retrieval.ts";
import { buildDocsIndex, readGuarded } from "../src/retrieval-build.ts";
import {
  contentHash,
  estimateTokens,
  indexSections,
  markdownBlocks,
} from "../src/retrieval-markdown.ts";
import type { DocsIndex, DocsReadReply, DocsSearchReply } from "../src/retrieval-types.ts";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function put(root: string, rel: string, text: string): Promise<void> {
  const file = path.join(root, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}

const EN =
  "# Approval gates\n\nHuman approval is required.\n\n## Blocking sensors\n\nA failed blocking sensor stops the approval gate.\n\n## Resume\n\nUse `/aidlc --resume`.\n";
const JA =
  "# 承認ゲート\n\n人の承認が必要です。\n\n## センサーの失敗\n\nブロッキングセンサーが失敗すると承認ゲートを停止します。\n";

async function seed(extra: Record<string, string> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "aidlc-retrieval-"));
  temporary.push(root);
  await put(
    root,
    "docs/official-docs.manifest.json",
    JSON.stringify({ sourceVersion: "2.7.1", upstreamSha: "a".repeat(40) }),
  );
  await put(root, "docs/guide/en/gates.md", EN);
  await put(root, "docs/guide/ja/gates.md", JA);
  await put(
    root,
    "docs/rfcs/en/future.md",
    "# Hyperquokka proposal\n\nProposed hyperquokka behavior.",
  );
  for (const [rel, body] of Object.entries(extra)) await put(root, rel, body);
  const index = await buildDocsIndex(root);
  await put(root, "docs/official-docs.index.json", JSON.stringify(index));
  return { root, index, library: createDocsLibrary(root) };
}

function success<T extends object>(reply: T): Exclude<T, { error: true }> {
  expect(reply).not.toHaveProperty("error");
  return reply as Exclude<T, { error: true }>;
}

describe("documentation retrieval", () => {
  it("uses current English for an unverified Japanese translation, without an intent", async () => {
    const { library, root } = await seed();
    const found = success(await library.search({ query: "承認ゲートでセンサーが失敗した場合" }));
    expect(found.results[0]?.headings.at(-1)).toBe("Blocking sensors");
    expect(found.results[0]?.locale).toBe("en");
    const read = success(await library.read({ id: found.results[0]?.id ?? "" }));
    expect(read.text).toBe(
      "## Blocking sensors\n\nA failed blocking sensor stops the approval gate.\n",
    );
    expect(read.source.version).toBe("2.7.1");
    expect(read.source.url).toBe(
      `https://github.com/awslabs/aidlc-workflows/blob/${"a".repeat(40)}/docs/guide/gates.md#L5-L8`,
    );
    expect(read.source.path).toBe(path.join(root, "docs/guide/en/gates.md").replace(/\\/g, "/"));
    expect(read.source.hash).toBe(contentHash(EN));
    expect(estimateTokens(serializeDocsReply(found))).toBeLessThanOrEqual(800);
    expect(estimateTokens(serializeDocsReply(read))).toBeLessThanOrEqual(1600);
  });

  it("serves only reviewed translations and rejects one whose source changes", async () => {
    const { root } = await seed();
    const approvals = { "guide/gates.md": { enHash: contentHash(EN), jaHash: contentHash(JA) } };
    await put(root, "docs/official-docs.translations.json", JSON.stringify(approvals));
    await regenerateDocsIndex(root);
    const library = createDocsLibrary(root);
    const found = success(await library.search({ query: "承認" }));
    expect(found.results[0]?.locale).toBe("ja");
    const id = found.results[0]?.id ?? "";
    expect(success(await library.read({ id })).text).toContain("承認");
    const translated = success(await library.read({ id }));
    expect(fileURLToPath(translated.source.url)).toBe(path.join(root, "docs/guide/ja/gates.md"));
    await put(root, "docs/guide/en/gates.md", `${EN}\nChanged source.`);
    expect(await library.read({ id })).toHaveProperty("reason", "stale_index");
    await regenerateDocsIndex(root);
    const fresh = success(await library.search({ query: "承認" }));
    expect(fresh.results[0]?.locale).toBe("en");
    expect(await library.read({ id })).toHaveProperty("reason", "translation_unverified");
  });

  it("keeps proposals out of ordinary answers and labels explicit research searches", async () => {
    const { library } = await seed();
    expect(success(await library.search({ query: "hyperquokka" })).results).toEqual([]);
    const found = success(
      await library.search({ query: "hyperquokka", include_non_normative: true }),
    );
    expect(found.results[0]?.kind).toBe("proposal");
  });

  it("returns bounded results and pagination reconstructs verbatim text", async () => {
    const body = `# Long reference\n\n${Array.from({ length: 40 }, (_, i) => `Paragraph ${i}. ${"Details. ".repeat(35)}`).join("\n\n")}`;
    const { library } = await seed({ "docs/reference/en/long.md": body });
    const found = success(
      await library.search({ query: "Long reference", limit: 1, max_tokens: 400 }),
    );
    const id = found.results[0]?.id ?? "";
    let text = "";
    let cursor = 0;
    let calls = 0;
    do {
      const read = success(await library.read({ id, cursor, max_tokens: 800 }));
      expect(estimateTokens(serializeDocsReply(read))).toBeLessThanOrEqual(800);
      expect(read.requiredTokens).toBeUndefined();
      text += read.text;
      calls++;
      if (!read.truncated) break;
      expect(read.nextCursor).toBeGreaterThan(cursor);
      cursor = read.nextCursor ?? 0;
    } while (calls < 100);
    expect(calls).toBeGreaterThan(1);
    expect(text).toBe(body);
    expect(await library.read({ id, cursor: 10000 })).toHaveProperty("reason", "invalid_cursor");
  });

  it("never cuts a table or fenced code; tells the caller the required budget", async () => {
    const body = `# Table\n\n| Name | Value |\n| --- | --- |\n${"| Column | Data |\n".repeat(250)}\n\n\`\`\`\`md\n# Not a section\n\`\`\`\n\nStill code\n\`\`\`\`\n`;
    const { library, index } = await seed({ "docs/reference/en/table.md": body });
    const page = index.pages.find((p) => p.path === "reference/table.md");
    expect(page?.sections.filter((s) => s.tableHeaderStart === undefined)).toHaveLength(1);
    const id = page?.sections[0]?.id ?? "";
    const first = success(await library.read({ id, max_tokens: 800 }));
    const blocked = success(await library.read({ id, cursor: first.nextCursor, max_tokens: 800 }));
    expect(blocked.text).toBe("");
    expect(blocked.nextCursor).toBeUndefined();
    expect(blocked.requiredTokens).toBeGreaterThan(800);
    const expanded = success(
      await library.read({ id, cursor: first.nextCursor, max_tokens: blocked.requiredTokens }),
    );
    expect(expanded.text).toContain("| Column | Data |");
    expect(expanded.text.match(/\| Column/g)).toHaveLength(250);
  });

  it("returns a terminal error for a block beyond the maximum budget", async () => {
    const { library, index } = await seed({
      "docs/reference/en/huge.md": `# Huge\n\n${"x".repeat(80000)}`,
    });
    const id = index.pages.find((p) => p.path === "reference/huge.md")?.sections[0]?.id ?? "";
    const first = success(await library.read({ id, max_tokens: 800 }));
    const blocked = await library.read({ id, cursor: first.nextCursor, max_tokens: 24000 });
    expect(blocked).toHaveProperty("reason", "block_too_large");
    expect(blocked).not.toHaveProperty("nextCursor");
    expect(blocked).not.toHaveProperty("requiredTokens");
  });

  it("encodes local source URLs and keeps line metadata separate", async () => {
    const { root, index, library } = await seed({
      "docs/guide/en/getting-started.md": "# Local guide\n\nStart here.",
    });
    const id =
      index.pages.find((p) => p.path === "guide/getting-started.md")?.sections[0]?.id ?? "";
    const read = success(await library.read({ id }));
    expect(new URL(read.source.url).protocol).toBe("file:");
    expect(fileURLToPath(read.source.url)).toBe(
      path.join(root, "docs/guide/en/getting-started.md"),
    );
    expect(read.source.lines).toEqual([1, 3]);
    const extra = "docs/guide/ja/日本語 space #%.md";
    await put(root, "docs/guide/en/日本語 space #%.md", EN);
    await put(root, extra, JA);
    await put(
      root,
      "docs/official-docs.translations.json",
      JSON.stringify({
        "guide/日本語 space #%.md": { enHash: contentHash(EN), jaHash: contentHash(JA) },
      }),
    );
    await regenerateDocsIndex(root);
    const updated = JSON.parse(
      await readFile(path.join(root, "docs/official-docs.index.json"), "utf8"),
    ) as DocsIndex;
    const jaId =
      updated.pages.find((p) => p.path === "guide/日本語 space #%.md" && p.locale === "ja")
        ?.sections[0]?.id ?? "";
    const ja = success(await library.read({ id: jaId }));
    expect(fileURLToPath(ja.source.url)).toBe(path.join(root, extra));
    expect(ja.source.url).toContain("%20");
    expect(ja.source.url).toContain("%23%25");
  });

  it.each([
    null,
    "hash",
    [],
    {},
    { enHash: "a".repeat(64) },
    { enHash: "g".repeat(64), jaHash: "b".repeat(64) },
  ])("rejects malformed approval %j without changing the index", async (entry) => {
    const { root } = await seed();
    const before = await readFile(path.join(root, "docs/official-docs.index.json"), "utf8");
    await put(
      root,
      "docs/official-docs.translations.json",
      JSON.stringify({ "guide/gates.md": entry }),
    );
    await expect(regenerateDocsIndex(root)).rejects.toThrow("guide/gates.md: enHash and jaHash");
    expect(await readFile(path.join(root, "docs/official-docs.index.json"), "utf8")).toBe(before);
  });

  it("rejects non-object approval roots and normalizes uppercase hashes", () => {
    for (const raw of [null, [], "value", 1])
      expect(() => parseTranslationApprovals(raw)).toThrow("document-path object required");
    expect(
      parseTranslationApprovals({
        "guide/gates.md": { enHash: "A".repeat(64), jaHash: "B".repeat(64) },
      })["guide/gates.md"]?.enHash,
    ).toBe("a".repeat(64));
  });

  it("makes child sections discoverable without repeating their text", async () => {
    const { library, index } = await seed();
    const id = index.pages[0]?.sections[0]?.id ?? "";
    const read = success(await library.read({ id }));
    expect(read.children.map((child) => child.heading)).toEqual(["Blocking sensors", "Resume"]);
    expect(read.text).not.toContain("A failed");
    const outline = success(await library.read({ id, mode: "outline" }));
    expect(outline.text).toContain("Blocking sensors");
    expect(outline.text).not.toContain("A failed");
  });

  it("does not turn arbitrary paths or stale IDs into reads", async () => {
    const { library, root, index } = await seed();
    expect(await library.read({ id: "../../secret.md" })).toHaveProperty("reason", "not_found");
    const id = index.pages[0]?.sections[0]?.id ?? "";
    await put(root, "docs/guide/en/gates.md", `${EN}\nChanged.`);
    expect(await library.read({ id })).toHaveProperty("reason", "stale_index");
    expect(await library.search({ query: "approval" })).toHaveProperty("reason", "stale_index");
  });

  it("rejects a manifest change, corrupt index and index traversal", async () => {
    const { root, index } = await seed();
    await put(root, "docs/official-docs.manifest.json", "{}");
    expect(await createDocsLibrary(root).search({ query: "approval" })).toHaveProperty(
      "reason",
      "stale_index",
    );
    await put(root, "docs/official-docs.index.json", "{broken");
    expect(await createDocsLibrary(root).search({ query: "approval" })).toHaveProperty(
      "reason",
      "docs_unavailable",
    );
    await put(
      root,
      "docs/official-docs.index.json",
      JSON.stringify({ ...index, schemaVersion: 99 }),
    );
    expect(await createDocsLibrary(root).search({ query: "approval" })).toHaveProperty(
      "reason",
      "invalid_index",
    );
    await put(
      root,
      "docs/official-docs.manifest.json",
      JSON.stringify({ sourceVersion: "2.7.1", upstreamSha: "a".repeat(40) }),
    );
    const page = index.pages[0];
    if (page === undefined) throw new Error("missing fixture page");
    page.path = "guide/../../../secret.md";
    await put(root, "docs/official-docs.index.json", JSON.stringify(index));
    expect(
      await createDocsLibrary(root).read({ id: index.pages[0]?.sections[0]?.id ?? "" }),
    ).toHaveProperty("reason", "path_rejected");
  });

  it("guards symlink escapes and never indexes a linked outside directory", async () => {
    const { root } = await seed();
    const outside = await mkdtemp(path.join(tmpdir(), "aidlc-outside-"));
    temporary.push(outside);
    await put(outside, "secret.md", "secret");
    await symlink(outside, path.join(root, "docs/guide/en/escape"), "junction");
    await expect(readGuarded(path.join(root, "docs/guide/en"), "escape/secret.md")).rejects.toThrow(
      "path_rejected",
    );
    expect((await buildDocsIndex(root)).pages.some((p) => p.path.includes("secret"))).toBe(false);
  });

  it.each([
    { query: "" },
    { query: "x".repeat(1001) },
    { query: "q", locale: "fr" },
    { query: "q", limit: 0 },
    { query: "q", max_tokens: 20 },
  ])("rejects invalid search input %j", async (input) => {
    expect(
      await createDocsLibrary("unused").search(
        input as Parameters<ReturnType<typeof createDocsLibrary>["search"]>[0],
      ),
    ).toHaveProperty("reason", "invalid_input");
  });

  it.each([
    { id: "x", cursor: -1 },
    { id: "x", mode: "bad" },
    { id: "x", max_tokens: 10 },
  ])("rejects invalid read input %j", async (input) => {
    expect(
      await createDocsLibrary("unused").read(
        input as Parameters<ReturnType<typeof createDocsLibrary>["read"]>[0],
      ),
    ).toHaveProperty("reason", "invalid_input");
  });

  it("reports missing docs, detects index drift, and supports the CLI", async () => {
    const { root } = await seed();
    await expect(regenerateDocsIndex(root, true)).rejects.toThrow("索引が古く"); // unformatted fixture lacks canonical newline
    await regenerateDocsIndex(root);
    await regenerateDocsIndex(root, true);
    const search = await runDocsCli(["search", "承認", "--root", root], "unused");
    expect(search.status).toBe(0);
    const found = JSON.parse(search.text) as DocsSearchReply;
    const read = await runDocsCli(["read", found.results[0]?.id ?? "", "--root", root], "unused");
    expect(read.status).toBe(0);
    expect((JSON.parse(read.text) as DocsReadReply).source.url).toContain("/blob/");
    expect((await runDocsCli(["--help"], root)).status).toBe(0);
    expect((await runDocsCli(["unknown"], root)).status).toBe(1);
    expect((await runDocsCli(["search", "x", "--bad"], root)).status).toBe(1);
    expect((await runDocsCli(["read", "bad"], root)).status).toBe(1);
    expect(
      await createDocsLibrary(path.join(root, "missing")).search({ query: "test" }),
    ).toHaveProperty("reason", "docs_unavailable");
    const index = JSON.parse(
      await readFile(path.join(root, "docs/official-docs.index.json"), "utf8"),
    ) as DocsIndex;
    expect(index.pages).not.toHaveLength(0);
  });
});

describe("Markdown index boundaries", () => {
  it("handles preambles, duplicate headings, closing hashes and fenced headings", () => {
    const text = "Preamble\n\n# Title #\n\n## Same\nFirst\n## Same\nSecond\n~~~md\n# Hidden\n~~~\n";
    const sections = indexSections(text, "page");
    expect(sections.map((s) => s.anchor)).toEqual(["", "title", "same", "same-1"]);
    expect(sections.map((s) => s.text).join("\n")).toBe(text);
    expect(indexSections("No heading", "p")[0]?.text).toBe("No heading");
    expect(markdownBlocks(text).join("")).toBe(text);
    expect(estimateTokens("あいう")).toBeGreaterThan(estimateTokens("abc"));
  });
});
