import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DocsShell } from "../src/components/DocsShell.tsx";
import { AnchorApplier, slugifyHeading } from "../src/components/docs-shell/AnchorApplier.tsx";
import { OfficialDocsButton } from "../src/components/OfficialDocsButton.tsx";
import { StoreProvider, useDispatch } from "../src/store/context.tsx";
import { reducer } from "../src/store/reducer.ts";
import { initialState } from "../src/store/state.ts";

const COMPONENTS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/components",
);

const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type StubOptions = {
  missingJa?: boolean;
  /** ja TOC omits concepts.md (asymmetric / sparse-ja). */
  sparseJaToc?: boolean;
  /** Page fetch returns not_found for the selected path. */
  notFoundPath?: string;
  /** Override anchorApplied on page responses. */
  anchorApplied?: "scrolled" | "top" | "none";
};

function stubOfficialDocsApi(options?: StubOptions): ReturnType<typeof vi.fn> {
  const missingJa = options?.missingJa === true;
  const sparseJaToc = options?.sparseJaToc === true;
  const notFoundPath = options?.notFoundPath;
  const anchorApplied = options?.anchorApplied ?? "none";

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === "/api/official-docs/manifest") {
      return new Response(
        JSON.stringify({
          ok: true,
          value: {
            sourceVersion: "aidlc 1.4.0",
            source: "aidlc-workflows",
            capturedAt: "2026-07-31T00:00:00.000Z",
          },
        }),
      );
    }
    if (path.includes("/api/official-docs/toc/")) {
      const isJa = path.includes("/toc/ja");
      const guide = [
        {
          id: "getting-started",
          title: "Getting started",
          path: "guide/getting-started.md",
          children: [],
        },
        ...(isJa && sparseJaToc
          ? []
          : [
              {
                id: "concepts",
                title: "Concepts",
                path: "guide/concepts.md",
                children: [],
              },
            ]),
      ];
      return new Response(
        JSON.stringify({
          ok: true,
          value: {
            guide,
            reference: [],
          },
        }),
      );
    }
    if (notFoundPath !== undefined && path.includes(`/${notFoundPath}`)) {
      return new Response(JSON.stringify({ error: true, reason: "not_found" }));
    }
    if (path.includes("/api/official-docs/ja/guide/getting-started.md") && missingJa) {
      return new Response(
        JSON.stringify({
          ok: true,
          value: {
            localeRequested: "ja",
            localeServed: "en",
            path: "guide/getting-started.md",
            bodyMarkdown: "# Getting started\n\nEnglish fallback body.\n",
            title: "Getting started",
            notice: "missing_ja",
            sourceVersion: "aidlc 1.4.0",
            anchorApplied,
          },
        }),
      );
    }
    if (path.includes("/guide/concepts.md")) {
      const isJa = path.includes("/ja/");
      return new Response(
        JSON.stringify({
          ok: true,
          value: {
            localeRequested: isJa ? "ja" : "en",
            localeServed: isJa && missingJa ? "en" : isJa ? "ja" : "en",
            path: "guide/concepts.md",
            bodyMarkdown:
              "# Concepts\n\n## Approval gates\n\nConcept body.\n\n[Gates](#approval-gates)\n",
            title: "Concepts",
            ...(isJa && missingJa ? { notice: "missing_ja" } : {}),
            sourceVersion: "aidlc 1.4.0",
            anchorApplied,
          },
        }),
      );
    }
    if (path.includes("/guide/getting-started.md")) {
      return new Response(
        JSON.stringify({
          ok: true,
          value: {
            localeRequested: path.includes("/ja/") ? "ja" : "en",
            localeServed: path.includes("/ja/") ? "ja" : "en",
            path: "guide/getting-started.md",
            bodyMarkdown:
              "# Getting started\n\nHello official docs.\n\n- **初めて使う方**: [Concepts](concepts.md)\n\nSee [AWS](https://example.com/).\n",
            title: "Getting started",
            sourceVersion: "aidlc 1.4.0",
            anchorApplied,
          },
        }),
      );
    }
    return new Response(JSON.stringify({ error: true, reason: "unexpected" }), { status: 500 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

function Harness(): ReactNode {
  return (
    <StoreProvider>
      <TooltipProvider>
        <OfficialDocsButton />
        <DocsShell />
      </TooltipProvider>
    </StoreProvider>
  );
}

function DeepLinkOpen({
  path,
  anchor,
  locale = "en",
}: {
  path: string;
  anchor: string;
  locale?: "en" | "ja";
}): null {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch({ type: "docs-shell", open: true, locale, path, anchor });
  }, [dispatch, path, anchor, locale]);
  return null;
}

function DeepLinkHarness({
  path,
  anchor,
  locale = "en",
}: {
  path: string;
  anchor: string;
  locale?: "en" | "ja";
}): ReactNode {
  return (
    <StoreProvider>
      <TooltipProvider>
        <DeepLinkOpen path={path} anchor={anchor} locale={locale} />
        <DocsShell />
      </TooltipProvider>
    </StoreProvider>
  );
}

async function openDocsDrawer(): Promise<void> {
  await userEvent.click(screen.getByTestId("docs-menu"));
  await waitFor(() => {
    expect(screen.getByTestId("docs-drawer")).toBeTruthy();
  });
}

async function pickToc(path: string): Promise<void> {
  await openDocsDrawer();
  const testId = `docs-toc-${path}`;
  await waitFor(() => {
    expect(screen.getByTestId(testId)).toBeTruthy();
  });
  await userEvent.click(screen.getByTestId(testId));
}

function AnchorHarness({
  anchorApplied,
  anchor,
}: {
  anchorApplied: "scrolled" | "top" | "none";
  anchor?: string;
}): ReactNode {
  const articleRef = useRef<HTMLElement>(null);
  return (
    <main ref={articleRef} data-testid="anchor-article" tabIndex={-1}>
      <h1>Concepts</h1>
      <h2>Approval gates</h2>
      <p>Body</p>
      <AnchorApplier
        anchorApplied={anchorApplied}
        anchor={anchor}
        articleRef={articleRef}
        contentKey={`${anchorApplied}:${anchor ?? ""}`}
      />
    </main>
  );
}

describe("DocsShell — walking skeleton", () => {
  it("loads manifest version, TOC, and page body (happy path)", async () => {
    stubOfficialDocsApi();
    render(<Harness />);

    await userEvent.click(screen.getByTestId("official-docs-open"));
    expect(screen.getByTestId("docs-shell")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("source-version").textContent).toContain("aidlc 1.4.0");
    });
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Hello official docs");
    });
    // List is in the left drawer, not beside the article.
    expect(screen.queryByTestId("docs-toc-guide/getting-started.md")).toBeNull();

    await pickToc("guide/concepts.md");
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Concept body");
    });
  });

  it("switches locale via LocaleControl and keeps path when present in both TOCs", async () => {
    const fetchMock = stubOfficialDocsApi();
    const posted: unknown[] = [];
    vi.stubGlobal("acquireVsCodeApi", () => ({
      postMessage: (message: unknown) => {
        posted.push(message);
      },
    }));
    render(<Harness />);

    await userEvent.click(screen.getByTestId("official-docs-open"));
    await waitFor(() => {
      expect(screen.getByTestId("locale-control").getAttribute("data-locale")).toBe("ja");
    });
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Hello official docs");
    });

    await pickToc("guide/concepts.md");
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Concept body");
    });
    await openDocsDrawer();
    expect(screen.getByTestId("docs-toc-guide/concepts.md").getAttribute("data-active")).toBe(
      "true",
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByTestId("docs-drawer")).toBeNull();
    });

    await userEvent.click(screen.getByTestId("locale-control"));
    await waitFor(() => {
      expect(screen.getByTestId("locale-control").getAttribute("data-locale")).toBe("en");
    });
    await waitFor(() => {
      const paths = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(paths.some((p) => p.includes("/api/official-docs/toc/en"))).toBe(true);
      expect(paths.some((p) => p.includes("/api/official-docs/en/guide/concepts.md"))).toBe(true);
    });
    await openDocsDrawer();
    await waitFor(() => {
      expect(screen.getByTestId("docs-toc-guide/concepts.md").getAttribute("data-active")).toBe(
        "true",
      );
    });
    expect(posted).toContainEqual({ type: "official-docs-locale", locale: "en" });
  });

  it("keep-path on sparse-ja TOC: path stays even when absent from ja TOC", async () => {
    const fetchMock = stubOfficialDocsApi({ sparseJaToc: true, missingJa: true });
    render(<Harness />);

    await userEvent.click(screen.getByTestId("official-docs-open"));
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("English fallback body");
    });

    await userEvent.click(screen.getByTestId("locale-control"));
    await waitFor(() => {
      expect(screen.getByTestId("locale-control").getAttribute("data-locale")).toBe("en");
    });

    await pickToc("guide/concepts.md");
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Concept body");
    });

    await userEvent.click(screen.getByTestId("locale-control"));
    await waitFor(() => {
      expect(screen.getByTestId("locale-control").getAttribute("data-locale")).toBe("ja");
    });

    // Path kept — still requests concepts under ja, not jump to getting-started.
    await waitFor(() => {
      const paths = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(paths.some((p) => p.includes("/api/official-docs/ja/guide/concepts.md"))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Concept body");
    });

    await openDocsDrawer();
    await waitFor(() => {
      expect(screen.getByTestId("docs-toc-guide/getting-started.md")).toBeTruthy();
    });
    // TOC highlight only when path ∈ TOC — concepts gone from sparse ja TOC.
    expect(screen.queryByTestId("docs-toc-guide/concepts.md")).toBeNull();
    const firstToc = screen.getByTestId("docs-toc-guide/getting-started.md");
    expect(firstToc.getAttribute("data-active")).not.toBe("true");
  });

  it("shows UntranslatedNotice only for missing_ja; LocaleControl stays on ja", async () => {
    stubOfficialDocsApi({ missingJa: true });
    render(<Harness />);

    await userEvent.click(screen.getByTestId("official-docs-open"));
    await waitFor(() => {
      expect(screen.getByTestId("untranslated-notice")).toBeTruthy();
    });
    expect(screen.getByTestId("untranslated-notice").getAttribute("role")).toBe("status");
    expect(screen.getByTestId("docs-article").textContent).toContain("English fallback body");
    // LocaleControl remains on localeRequested (ja), not localeServed (en).
    expect(screen.getByTestId("locale-control").getAttribute("data-locale")).toBe("ja");
    expect(screen.getByTestId("locale-control").textContent).toBe("JA");
    expect(screen.getByTestId("locale-control").getAttribute("aria-label")).toBe("英語に切り替え");
  });

  it("404 / not_found never shows UntranslatedNotice", async () => {
    stubOfficialDocsApi({ notFoundPath: "guide/concepts.md" });
    render(<Harness />);

    await userEvent.click(screen.getByTestId("official-docs-open"));
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Hello official docs");
    });

    await pickToc("guide/concepts.md");
    await waitFor(() => {
      expect(screen.getByText("読み込みエラー")).toBeTruthy();
    });
    expect(screen.queryByTestId("untranslated-notice")).toBeNull();
  });

  it("soft Should FR-B2-S1: article exposes h1 page title when available", async () => {
    stubOfficialDocsApi();
    render(<Harness />);

    await userEvent.click(screen.getByTestId("official-docs-open"));
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Hello official docs");
    });
    // Soft: present when DocsShell cheap path ships; MarkdownSurface still demotes # → h3.
    const h1 = screen.queryByTestId("docs-article-h1");
    expect(h1).toBeTruthy();
    expect(h1?.tagName).toBe("H1");
    expect(h1?.textContent).toContain("Getting started");
  });

  it("deep-link open wires path + anchor into the page fetch (FR-B2-3)", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const fetchMock = stubOfficialDocsApi({ anchorApplied: "scrolled" });
    render(<DeepLinkHarness path="guide/concepts.md" anchor="#approval-gates" />);

    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Concept body");
    });
    await waitFor(() => {
      const paths = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        paths.some(
          (p) =>
            p.includes("/api/official-docs/en/guide/concepts.md") &&
            p.includes("anchor=approval-gates"),
        ),
      ).toBe(true);
    });
  });

  it("deep-link locale applies to LocaleControl before path fetch (FR-B3-4.3)", async () => {
    const fetchMock = stubOfficialDocsApi();
    render(<DeepLinkHarness path="guide/concepts.md" anchor="approval-gates" locale="ja" />);

    await waitFor(() => {
      expect(screen.getByTestId("locale-control").getAttribute("data-locale")).toBe("ja");
    });
    await waitFor(() => {
      const paths = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(paths.some((p) => p.includes("/api/official-docs/toc/ja"))).toBe(true);
      expect(paths.some((p) => p.includes("/api/official-docs/ja/guide/concepts.md"))).toBe(true);
    });
  });

  it("follows a relative .md link in the article to another official-docs page", async () => {
    const fetchMock = stubOfficialDocsApi();
    render(<Harness />);

    await userEvent.click(screen.getByTestId("official-docs-open"));
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Hello official docs");
    });
    vi.mocked(Element.prototype.scrollIntoView).mockClear();

    await userEvent.click(screen.getByRole("link", { name: "Concepts" }));
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Concept body");
    });
    const paths = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(paths.some((p) => p.includes("/api/official-docs/ja/guide/concepts.md"))).toBe(true);
    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });

  it("re-applies the same fragment when the in-page hash link is clicked again", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    stubOfficialDocsApi({ anchorApplied: "scrolled" });
    render(<DeepLinkHarness path="guide/concepts.md" anchor="#approval-gates" />);

    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Concept body");
    });
    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
    vi.mocked(Element.prototype.scrollIntoView).mockClear();

    await userEvent.click(screen.getByRole("link", { name: "Gates" }));
    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });

  it("leaves an https link as navigation the shell does not intercept", async () => {
    stubOfficialDocsApi();
    render(<Harness />);

    await userEvent.click(screen.getByTestId("official-docs-open"));
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "AWS" })).toBeTruthy();
    });

    await userEvent.click(screen.getByRole("link", { name: "AWS" }));
    expect(screen.getByTestId("docs-article").textContent).toContain("Hello official docs");
    expect(screen.getByTestId("docs-article").textContent).not.toContain("Concept body");
  });
});

describe("AnchorApplier", () => {
  it("slugifyHeading matches GitHub-style anchors", () => {
    expect(slugifyHeading("Approval gates")).toBe("approval-gates");
  });

  it("none → does not scroll", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<AnchorHarness anchorApplied="none" anchor="approval-gates" />);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("top → scrolls/focuses article", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<AnchorHarness anchorApplied="top" />);
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
    expect(document.activeElement).toBe(screen.getByTestId("anchor-article"));
  });

  it("scrolled → scrolls/focuses matching heading", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<AnchorHarness anchorApplied="scrolled" anchor="approval-gates" />);
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
    expect(document.activeElement?.textContent).toBe("Approval gates");
  });
});

describe("docs-shell route exclusivity", () => {
  it("clears stage / guides when docs shell opens, and vice versa", () => {
    const withStage = reducer(initialState, {
      type: "select",
      selection: { kind: "stage", slug: "code-generation" },
    });
    const shell = reducer(withStage, {
      type: "docs-shell",
      open: true,
      locale: "en",
      path: "guide/concepts.md",
      anchor: "approval-gates",
    });
    expect(shell.docsShellOpen).toBe(true);
    expect(shell.docsShellDeepLink).toEqual({
      locale: "en",
      path: "guide/concepts.md",
      anchor: "approval-gates",
    });
    expect(shell.officialDocsLocale).toBe("en");
    expect(shell.selected).toBeNull();

    const guides = reducer(shell, { type: "guides", open: true });
    expect(guides.guidesOpen).toBe(true);
    expect(guides.docsShellOpen).toBe(false);
    expect(guides.docsShellDeepLink).toBeNull();

    const back = reducer(guides, { type: "docs-shell", open: true });
    expect(back.docsShellOpen).toBe(true);
    expect(back.docsShellDeepLink).toBeNull();
    expect(back.guidesOpen).toBe(false);

    const home = reducer(back, { type: "home" });
    expect(home.docsShellOpen).toBe(false);
    expect(home.docsShellDeepLink).toBeNull();
  });
});

describe("docs-shell boundary", () => {
  it("DocsShell module source does not import official-docs or reader-core", async () => {
    const files = [
      "DocsShell.tsx",
      "docs-shell/AnchorApplier.tsx",
      "docs-shell/DocsToc.tsx",
      "docs-shell/LocaleControl.tsx",
      "docs-shell/UntranslatedNotice.tsx",
      "docs-shell/SourceVersionBadge.tsx",
      "docs-shell/resolve-doc-href.ts",
    ];
    for (const rel of files) {
      const src = await readFile(path.join(COMPONENTS_ROOT, rel), "utf8");
      expect(src).not.toMatch(/@aidlc-guide\/official-docs/);
      expect(src).not.toMatch(/@aidlc-guide\/reader-core/);
      expect(src).not.toMatch(/from ["'].*reader-core/);
    }
  });
});
