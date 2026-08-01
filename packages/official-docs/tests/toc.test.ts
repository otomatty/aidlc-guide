import { describe, expect, it } from "vitest";
import { listToc } from "../src/toc.ts";
import { expectError, expectOk, workspaceRoot } from "./helpers.ts";

describe("listToc", () => {
  it("returns a non-empty guide + reference tree for en", async () => {
    const toc = expectOk(await listToc(workspaceRoot, "en"));
    expect(toc.guide.length).toBeGreaterThan(0);
    expect(toc.reference.length).toBeGreaterThan(0);
    expect(toc.guide.some((n) => n.path === "guide/getting-started.md")).toBe(true);
    expect(toc.reference.some((n) => n.path === "reference/scopes.md")).toBe(true);
    expect(toc.guide[0]?.title.length).toBeGreaterThan(0);
  });

  it("keeps en structure for ja when ja is sparse", async () => {
    const toc = expectOk(await listToc(workspaceRoot, "ja"));
    expect(toc.guide.some((n) => n.path === "guide/getting-started.md")).toBe(true);
    expect(toc.reference.some((n) => n.path === "reference/scopes.md")).toBe(true);
    const jaGuide = toc.guide.find((n) => n.path === "guide/getting-started.md");
    expect(jaGuide?.title).toBe("はじめに");
    const ref = toc.reference.find((n) => n.path === "reference/scopes.md");
    // ja missing → en title fallback
    expect(ref?.title).toBe("Scopes");
  });

  it("rejects invalid locale", async () => {
    expectError(await listToc(workspaceRoot, "de"), "path_rejected");
  });
});
