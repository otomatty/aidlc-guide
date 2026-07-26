import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listGuides, readGuide } from "../src/handlers/guides.ts";

async function seedGuides(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "guides-"));
  const dir = path.join(root, "docs", "guides");
  await mkdir(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    await writeFile(path.join(dir, name), body);
  }
  return root;
}

describe("listGuides / readGuide", () => {
  it("lists markdown under docs/guides in preferred order", async () => {
    const root = await seedGuides({
      "async-sharing.md": "# Async\n",
      "getting-started.md": "# はじめに\n",
      "README.md": "# Index\n",
      "notes.txt": "ignored",
    });
    const listed = await listGuides(root);
    expect(listed).toMatchObject({ ok: true });
    if (!("ok" in listed)) return;
    expect(listed.value.map((g) => g.name)).toEqual([
      "README.md",
      "getting-started.md",
      "async-sharing.md",
    ]);
    expect(listed.value[1]?.title).toBe("はじめに");
  });

  it("returns empty when the guides directory is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "guides-empty-"));
    await expect(listGuides(root)).resolves.toMatchObject({ ok: true, value: [] });
  });

  it("reads a guide body and refuses path traversal", async () => {
    const root = await seedGuides({ "getting-started.md": "# Start\n\nBody.\n" });
    const ok = await readGuide(root, "getting-started.md");
    expect(ok).toEqual({
      ok: true,
      value: {
        name: "getting-started.md",
        title: "Start",
        markdown: "# Start\n\nBody.\n",
      },
    });

    await expect(readGuide(root, "../secrets.md")).resolves.toEqual({
      error: true,
      reason: "not-found",
    });
    await expect(readGuide(root, "nope.md")).resolves.toEqual({
      error: true,
      reason: "not-found",
    });
  });
});
