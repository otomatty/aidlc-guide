import { describe, expect, it } from "vitest";
import { projectSlug } from "../src/slug.ts";

describe("projectSlug", () => {
  // Both cases must pass on either host OS — the transform is pure string
  // substitution precisely so that it does not depend on where it runs.
  it("converts a Windows absolute path", () => {
    expect(projectSlug("C:\\work\\aidlc-guide")).toBe("C--work-aidlc-guide");
  });

  it("converts a macOS absolute path", () => {
    expect(projectSlug("/Users/dev/aidlc-guide")).toBe("-Users-dev-aidlc-guide");
  });

  it("replaces dots", () => {
    expect(projectSlug("/Users/dev/my.app")).toBe("-Users-dev-my-app");
  });

  it("leaves spaces, hyphens and other characters alone", () => {
    expect(projectSlug("/Users/dev/my project & co")).toBe("-Users-dev-my project & co");
  });

  it("replaces each character individually, not runs", () => {
    expect(projectSlug("C:\\\\a")).toBe("C---a");
  });
});
