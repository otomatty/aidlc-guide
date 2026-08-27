import { describe, expect, it } from "vitest";
import { folderLabel, humanizeDirName } from "../src/folder-labels.ts";
import { listToc } from "../src/toc.ts";
import type { TocNode } from "../src/types.ts";
import { expectError, expectOk, workspaceRoot } from "./helpers.ts";

/** Every node's path in tree order — the flat view the UI matches deep links on. */
function paths(nodes: readonly TocNode[]): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    if (node.path !== undefined) out.push(node.path);
    out.push(...paths(node.children));
  }
  return out;
}

function findNode(nodes: readonly TocNode[], id: string): TocNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findNode(node.children, id);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

describe("listToc", () => {
  it("returns a non-empty guide + reference tree for en", async () => {
    const toc = expectOk(await listToc(workspaceRoot, "en"));
    expect(toc.guide.length).toBeGreaterThan(0);
    expect(toc.reference.length).toBeGreaterThan(0);
    expect(toc.guide.some((n) => n.path === "guide/getting-started.md")).toBe(true);
    expect(toc.reference.some((n) => n.path === "reference/scopes.md")).toBe(true);
    expect(toc.guide[0]?.title.length).toBeGreaterThan(0);
  }, 20_000);

  it("nests a directory under a category node named by its README", async () => {
    const toc = expectOk(await listToc(workspaceRoot, "en"));

    // Sub-directory pages are no longer top-level rows.
    expect(toc.guide.some((n) => n.path === "guide/harnesses/cursor.md")).toBe(false);

    const harnesses = toc.guide.find((n) => n.id === "guide/harnesses");
    expect(harnesses).toBeDefined();
    // README names the folder and is the page the category row opens…
    expect(harnesses?.path).toBe("guide/harnesses/README.md");
    expect(harnesses?.title).toBe("Running on other harnesses");
    // …rather than being repeated as a child row.
    expect(harnesses?.children.some((n) => n.path === "guide/harnesses/README.md")).toBe(false);
    expect(harnesses?.children.some((n) => n.path === "guide/harnesses/cursor.md")).toBe(true);
  }, 20_000);

  it("labels a README-less directory and leaves it unclickable", async () => {
    const en = expectOk(await listToc(workspaceRoot, "en"));
    const stages = en.reference.find((n) => n.id === "reference/04-stages");
    expect(stages).toBeDefined();
    expect(stages?.path).toBeUndefined();
    expect(stages?.title).toBe("Stages");
    expect(stages?.children.some((n) => n.path === "reference/04-stages/ideation.md")).toBe(true);

    const ja = expectOk(await listToc(workspaceRoot, "ja"));
    expect(ja.reference.find((n) => n.id === "reference/04-stages")?.title).toBe("ステージ");
  }, 20_000);

  it("orders files before sub-directories at every level", async () => {
    const toc = expectOk(await listToc(workspaceRoot, "en"));
    const firstDir = toc.guide.findIndex((n) => n.children.length > 0);
    expect(firstDir).toBeGreaterThan(0);
    expect(toc.guide.slice(0, firstDir).every((n) => n.children.length === 0)).toBe(true);
    expect(toc.guide.slice(firstDir).every((n) => n.children.length > 0)).toBe(true);
  }, 20_000);

  it("keeps en structure for ja when ja is sparse", async () => {
    const en = expectOk(await listToc(workspaceRoot, "en"));
    const toc = expectOk(await listToc(workspaceRoot, "ja"));
    // Locale-scoped response: same inventory shape as en (sparse ja), not a merged dual tree.
    expect(paths(toc.guide)).toEqual(paths(en.guide));
    expect(paths(toc.reference)).toEqual(paths(en.reference));
    expect(toc.guide.some((n) => n.path === "guide/getting-started.md")).toBe(true);
    expect(toc.reference.some((n) => n.path === "reference/scopes.md")).toBe(true);
    const jaGuide = toc.guide.find((n) => n.path === "guide/getting-started.md");
    expect(jaGuide?.title).toBe("はじめに");
    const ref = toc.reference.find((n) => n.path === "reference/scopes.md");
    // ja missing → en title fallback
    expect(ref?.title).toBe("Scopes");
    // Nested titles localise too.
    expect(findNode(toc.guide, "guide/agents")?.title).toBe("エージェント詳細");
  }, 20_000);

  it("rejects invalid locale", async () => {
    expectError(await listToc(workspaceRoot, "de"), "path_rejected");
  });
});

describe("folderLabel", () => {
  it("uses the label table, per locale, with en as the fallback locale", () => {
    expect(folderLabel("reference", "04-stages", "en")).toBe("Stages");
    expect(folderLabel("reference", "04-stages", "ja")).toBe("ステージ");
  });

  it("names an unlisted directory from its own name, so a new upstream folder still reads", () => {
    // No hand-maintained taxonomy: a folder the table has never seen still
    // gets a sensible category name rather than an empty heading.
    expect(folderLabel("reference", "20-new-topic", "ja")).toBe("New Topic");
    expect(folderLabel("guide", "harnesses/legacy_shells", "en")).toBe("Legacy Shells");
  });
});

describe("humanizeDirName", () => {
  it("drops an ordering prefix and title-cases the rest", () => {
    expect(humanizeDirName("04-stages")).toBe("Stages");
    expect(humanizeDirName("kiro_windows-output")).toBe("Kiro Windows Output");
  });

  it("falls back to the raw name when nothing is left to title-case", () => {
    expect(humanizeDirName("-")).toBe("-");
  });
});
