import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DOC_SECTIONS } from "../src/roots.ts";

const root = join(import.meta.dirname, "../../..");

describe("official docs snapshot (content-snapshot / US-01, US-07)", () => {
  it("keeps guide and reference en trees non-empty", () => {
    const guideEn = join(root, "docs/guide/en/getting-started.md");
    const refEn = join(root, "docs/reference/en/scopes.md");
    expect(existsSync(guideEn)).toBe(true);
    expect(existsSync(refEn)).toBe(true);
    expect(readFileSync(guideEn, "utf8").trim().length).toBeGreaterThan(0);
    expect(readFileSync(refEn, "utf8").trim().length).toBeGreaterThan(0);
  });

  // A section whose en tree never landed ships an empty book in the Shell nav
  // and no build step notices; the snapshot is the only place that can tell.
  it("ships a non-empty en tree for every active bundled section", () => {
    for (const section of DOC_SECTIONS) {
      // 2.8 removed RFCs. Its API key remains for older snapshots, but a fresh
      // checkout has no directory: Git does not preserve empty directories.
      if (section === "rfcs") continue;
      const enRoot = join(root, "docs", section, "en");
      expect(existsSync(enRoot), `${section}/en exists`).toBe(true);
      expect(
        readdirSync(enRoot).some((file) => file.endsWith(".md")),
        `${section}/en contains Markdown`,
      ).toBe(true);
    }
  });

  it("mirrors upstream's docs-root pages as the overview section", () => {
    const readme = join(root, "docs/overview/en/README.md");
    expect(existsSync(readme)).toBe(true);
    expect(readFileSync(readme, "utf8").trim().length).toBeGreaterThan(0);
    // Read non-recursively upstream: no other section may reappear under it.
    for (const section of DOC_SECTIONS.filter((s) => s !== "overview")) {
      expect(existsSync(join(root, "docs/overview/en", section))).toBe(false);
    }
  });

  it("does not place official trees under product docs/guides", () => {
    expect(existsSync(join(root, "docs/guide/en"))).toBe(true);
    expect(existsSync(join(root, "docs/guides"))).toBe(true);
    expect(join(root, "docs/guide")).not.toBe(join(root, "docs/guides"));
  });

  it("records a non-empty official-docs manifest", () => {
    const raw = readFileSync(join(root, "docs/official-docs.manifest.json"), "utf8");
    const manifest = JSON.parse(raw) as {
      sourceVersion: string;
      source: string;
      capturedAt: string;
    };
    expect(manifest.sourceVersion.length).toBeGreaterThan(0);
    expect(manifest.source).toBe("aidlc-workflows");
    expect(manifest.capturedAt.length).toBeGreaterThan(0);
  });

  it("ships at least one ja bootstrap page", () => {
    const ja = join(root, "docs/guide/ja/getting-started.md");
    expect(existsSync(ja)).toBe(true);
    expect(readFileSync(ja, "utf8").trim().length).toBeGreaterThan(0);
  });
});
