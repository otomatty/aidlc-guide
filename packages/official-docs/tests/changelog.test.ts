import { describe, expect, it } from "vitest";
import { buildChangelogPages } from "../src/changelog.ts";

describe("bundled changelog", () => {
  it("keeps complete release entries, dates, order and navigable documentation links", () => {
    const pages = buildChangelogPages(
      "# Changelog\r\n\r\n## [2.8.0] - 2026-09-08\r\n\r\nNew baseline.\r\n\r\n* Fix A\r\n* **Upgrade:** run installer.\r\n\r\n## [2.7.2] - 2026-09-07\r\n\r\n[Setup](docs/guide/01-getting-started.md#install)\r\n",
    );
    expect([...pages.keys()]).toEqual([
      "overview/releases/2.8.0.md",
      "overview/releases/2.7.2.md",
      "overview/changelog.md",
    ]);
    expect(pages.get("overview/changelog.md")).toContain("[2.8.0](releases/2.8.0.md) | 2026-09-08");
    expect(pages.get("overview/releases/2.8.0.md")).toContain(
      "* Fix A\n* **Upgrade:** run installer.",
    );
    expect(pages.get("overview/releases/2.8.0.md")).not.toContain("## [2.7.2]");
    expect(pages.get("overview/releases/2.7.2.md")).toContain(
      "https://github.com/awslabs/aidlc-workflows/blob/HEAD/docs/guide/01-getting-started.md#install",
    );
  });

  it("rejects missing, duplicate and unsafe release identifiers before generating files", () => {
    expect(() => buildChangelogPages("# Empty")).toThrow("no release headings");
    expect(() => buildChangelogPages("## [../escape]\nBad")).toThrow("Unsupported");
    expect(() => buildChangelogPages("## [2.8.0]\nOne\n## [2.8.0]\nTwo")).toThrow("Duplicate");
  });
});
