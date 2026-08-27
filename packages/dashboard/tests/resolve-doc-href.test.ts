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
