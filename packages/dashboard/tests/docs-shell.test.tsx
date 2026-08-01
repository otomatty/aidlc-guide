import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DocsShell } from "../src/components/DocsShell.tsx";
import { OfficialDocsButton } from "../src/components/OfficialDocsButton.tsx";
import { StoreProvider } from "../src/store/context.tsx";
import { reducer } from "../src/store/reducer.ts";
import { initialState } from "../src/store/state.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubOfficialDocsApi(options?: { missingJa?: boolean }): ReturnType<typeof vi.fn> {
  const missingJa = options?.missingJa === true;
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
      return new Response(
        JSON.stringify({
          ok: true,
          value: {
            guide: [
              {
                id: "getting-started",
                title: "Getting started",
                path: "guide/getting-started.md",
                children: [],
              },
              {
                id: "concepts",
                title: "Concepts",
                path: "guide/concepts.md",
                children: [],
              },
            ],
            reference: [],
          },
        }),
      );
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
            anchorApplied: "none",
          },
        }),
      );
    }
    if (path.includes("/guide/concepts.md")) {
      return new Response(
        JSON.stringify({
          ok: true,
          value: {
            localeRequested: "en",
            localeServed: "en",
            path: "guide/concepts.md",
            bodyMarkdown: "# Concepts\n\nConcept body.\n",
            title: "Concepts",
            sourceVersion: "aidlc 1.4.0",
            anchorApplied: "none",
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
            bodyMarkdown: "# Getting started\n\nHello official docs.\n",
            title: "Getting started",
            sourceVersion: "aidlc 1.4.0",
            anchorApplied: "none",
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
      expect(screen.getByTestId("docs-toc-guide/getting-started.md")).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Hello official docs");
    });

    await userEvent.click(screen.getByTestId("docs-toc-guide/concepts.md"));
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Concept body");
    });
  });

  it("switches locale via LocaleControl", async () => {
    const fetchMock = stubOfficialDocsApi();
    render(<Harness />);

    await userEvent.click(screen.getByTestId("official-docs-open"));
    await waitFor(() => {
      expect(screen.getByTestId("locale-en").getAttribute("aria-current")).toBe("true");
    });

    await userEvent.click(screen.getByTestId("locale-ja"));
    await waitFor(() => {
      expect(screen.getByTestId("locale-ja").getAttribute("aria-current")).toBe("true");
    });
    await waitFor(() => {
      const paths = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(paths.some((path) => path.includes("/api/official-docs/toc/ja"))).toBe(true);
      expect(paths.some((path) => path.includes("/api/official-docs/ja/guide/"))).toBe(true);
    });
  });

  it("shows UntranslatedNotice when notice is missing_ja", async () => {
    stubOfficialDocsApi({ missingJa: true });
    render(<Harness />);

    await userEvent.click(screen.getByTestId("official-docs-open"));
    await waitFor(() => {
      expect(screen.getByTestId("docs-article").textContent).toContain("Hello official docs");
    });

    await userEvent.click(screen.getByTestId("locale-ja"));
    await waitFor(() => {
      expect(screen.getByTestId("untranslated-notice")).toBeTruthy();
    });
    expect(screen.getByTestId("untranslated-notice").getAttribute("role")).toBe("status");
    expect(screen.getByTestId("docs-article").textContent).toContain("English fallback body");
  });
});

describe("docs-shell route exclusivity", () => {
  it("clears stage / guides when docs shell opens, and vice versa", () => {
    const withStage = reducer(initialState, {
      type: "select",
      selection: { kind: "stage", slug: "code-generation" },
    });
    const shell = reducer(withStage, { type: "docs-shell", open: true });
    expect(shell.docsShellOpen).toBe(true);
    expect(shell.selected).toBeNull();

    const guides = reducer(shell, { type: "guides", open: true });
    expect(guides.guidesOpen).toBe(true);
    expect(guides.docsShellOpen).toBe(false);

    const back = reducer(guides, { type: "docs-shell", open: true });
    expect(back.docsShellOpen).toBe(true);
    expect(back.guidesOpen).toBe(false);

    const home = reducer(back, { type: "home" });
    expect(home.docsShellOpen).toBe(false);
  });
});
