import { describe, expect, it } from "vitest";
import { resolveOfficialDocHref } from "../src/components/docs-shell/resolve-doc-href.ts";

describe("resolveOfficialDocHref", () => {
  const current = "guide/00-introduction.md";

  it("resolves a same-directory page against the current official-docs path", () => {
    expect(resolveOfficialDocHref(current, "01-getting-started.md")).toEqual({
      path: "guide/01-getting-started.md",
      anchor: undefined,
    });
    expect(resolveOfficialDocHref(current, "./workflow-profiles.md")).toEqual({
      path: "guide/workflow-profiles.md",
      anchor: undefined,
    });
  });

  it("resolves a nested page and a cross-section ../reference link", () => {
    expect(resolveOfficialDocHref(current, "harnesses/README.md")).toEqual({
      path: "guide/harnesses/README.md",
      anchor: undefined,
    });
    expect(resolveOfficialDocHref(current, "../reference/17-skill-system.md")).toEqual({
      path: "reference/17-skill-system.md",
      anchor: undefined,
    });
    expect(resolveOfficialDocHref(current, "../reference/00-overview.md#engine")).toEqual({
      path: "reference/00-overview.md",
      anchor: "engine",
    });
    // Extra `..` clips at the origin; the section allow-list still accepts a
    // landing path under reference/. Rejecting this would not add a guard.
    expect(resolveOfficialDocHref(current, "../../reference/17-skill-system.md")).toEqual({
      path: "reference/17-skill-system.md",
      anchor: undefined,
    });
  });

  it("decodes a percent-encoded fragment so Japanese heading slugs match", () => {
    expect(
      resolveOfficialDocHref(current, "12-cli-commands.md#aidlc---doctor--健全性チェック"),
    ).toEqual({
      path: "guide/12-cli-commands.md",
      anchor: "aidlc---doctor--健全性チェック",
    });
    expect(
      resolveOfficialDocHref(
        current,
        "12-cli-commands.md#aidlc---doctor--%E5%81%A5%E5%85%A8%E6%80%A7%E3%83%81%E3%82%A7%E3%83%83%E3%82%AF",
      ),
    ).toEqual({
      path: "guide/12-cli-commands.md",
      anchor: "aidlc---doctor--健全性チェック",
    });
    expect(resolveOfficialDocHref(current, "12-cli-commands.md#%ZZ")).toBeNull();
  });

  it("resolves a directory href to that folder's README.md", () => {
    expect(resolveOfficialDocHref("reference/00-overview.md", "agents/")).toEqual({
      path: "reference/agents/README.md",
      anchor: undefined,
    });
    expect(
      resolveOfficialDocHref("reference/18-plugin-mechanism.md", "examples/test-pro/"),
    ).toEqual({
      path: "reference/examples/test-pro/README.md",
      anchor: undefined,
    });
  });

  it("falls back to the first catalog page when a directory has no README", () => {
    const known = [
      "reference/04-stages/construction.md",
      "reference/04-stages/ideation.md",
      "reference/agents/README.md",
    ];
    expect(resolveOfficialDocHref("reference/00-overview.md", "04-stages/", known)).toEqual({
      path: "reference/04-stages/construction.md",
      anchor: undefined,
    });
    expect(resolveOfficialDocHref("reference/00-overview.md", "agents/", known)).toEqual({
      path: "reference/agents/README.md",
      anchor: undefined,
    });
    expect(resolveOfficialDocHref("reference/00-overview.md", "missing-dir/", known)).toBeNull();
  });

  it("keeps a same-page fragment on the current path", () => {
    expect(resolveOfficialDocHref("guide/concepts.md", "#approval-gates")).toEqual({
      path: "guide/concepts.md",
      anchor: "approval-gates",
    });
  });

  it("refuses schemes, escapes, and non-markdown targets", () => {
    expect(
      resolveOfficialDocHref(current, "https://github.com/awslabs/aidlc-workflows"),
    ).toBeNull();
    expect(resolveOfficialDocHref(current, "javascript:alert(1)")).toBeNull();
    expect(resolveOfficialDocHref(current, "//evil.example.com/x.md")).toBeNull();
    expect(resolveOfficialDocHref(current, "../../../etc/passwd.md")).toBeNull();
    expect(resolveOfficialDocHref(current, "diagram.png")).toBeNull();
    expect(resolveOfficialDocHref(current, "")).toBeNull();
    expect(resolveOfficialDocHref(current, "   ")).toBeNull();
  });
});
