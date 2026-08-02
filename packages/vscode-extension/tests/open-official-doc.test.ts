import { describe, expect, it, vi } from "vitest";
import {
  getLastOfficialDocsLocale,
  handleOpenOfficialDoc,
  injectDocsShellDeepLink,
  OFFICIAL_DOCS_LOCALE_KEY,
} from "../src/open-official-doc.ts";

function mockContext(initial?: unknown) {
  let stored: unknown = initial;
  const update = vi.fn(async (key: string, value: unknown) => {
    if (key === OFFICIAL_DOCS_LOCALE_KEY) stored = value;
  });
  return {
    context: {
      globalState: {
        get: (key: string) => (key === OFFICIAL_DOCS_LOCALE_KEY ? stored : undefined),
        update,
        keys: () => [],
        setKeysForSync: () => undefined,
      },
    },
    update,
    getStored: () => stored,
  };
}

describe("handleOpenOfficialDoc", () => {
  it("valid mapped → persist locale + inject path/anchor (no vscode.open)", () => {
    const { context, update, getStored } = mockContext();
    const outcome = handleOpenOfficialDoc(
      {
        type: "open-official-doc",
        locale: "ja",
        path: "guide/getting-started.md",
        anchor: "approval-gates",
      },
      context,
    );
    expect(outcome).toEqual({
      ok: true,
      inject: {
        type: "docs-shell-deeplink",
        locale: "ja",
        path: "guide/getting-started.md",
        anchor: "approval-gates",
      },
    });
    expect(update).toHaveBeenCalledWith(OFFICIAL_DOCS_LOCALE_KEY, "ja");
    expect(getStored()).toBe("ja");
  });

  it("unmapped → inject locale-only (omit path/anchor keys)", () => {
    const { context, update } = mockContext();
    const outcome = handleOpenOfficialDoc({ type: "open-official-doc", locale: "en" }, context);
    expect(outcome).toEqual({
      ok: true,
      inject: { type: "docs-shell-deeplink", locale: "en" },
    });
    expect(outcome.ok && "path" in outcome.inject).toBe(false);
    expect(outcome.ok && "anchor" in outcome.inject).toBe(false);
    expect(update).toHaveBeenCalledWith(OFFICIAL_DOCS_LOCALE_KEY, "en");
  });

  it("invalid locale → ignore (no persist)", () => {
    const { context, update } = mockContext("en");
    const outcome = handleOpenOfficialDoc(
      { type: "open-official-doc", locale: "de", path: "guide/x.md" },
      context,
    );
    expect(outcome).toEqual({ ok: false, reason: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });

  it("empty path → ignore (not unmapped success)", () => {
    const { context, update } = mockContext();
    const outcome = handleOpenOfficialDoc(
      { type: "open-official-doc", locale: "en", path: "" },
      context,
    );
    expect(outcome).toEqual({ ok: false, reason: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });

  it("inject posts docs-shell-deeplink and never opens vscode", () => {
    const { context } = mockContext();
    const posted: unknown[] = [];
    const outcome = handleOpenOfficialDoc(
      { type: "open-official-doc", locale: "en", path: "guide/concepts.md" },
      context,
    );
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      injectDocsShellDeepLink({ postMessage: (m) => posted.push(m) }, outcome.inject);
    }
    expect(posted).toEqual([
      { type: "docs-shell-deeplink", locale: "en", path: "guide/concepts.md" },
    ]);
  });
});

describe("getLastOfficialDocsLocale", () => {
  it("returns stored en|ja; corrupt → en", () => {
    expect(getLastOfficialDocsLocale(mockContext("ja").context)).toBe("ja");
    expect(getLastOfficialDocsLocale(mockContext("en").context)).toBe("en");
    expect(getLastOfficialDocsLocale(mockContext("nope").context)).toBe("en");
    expect(getLastOfficialDocsLocale(mockContext(undefined).context)).toBe("en");
  });
});
