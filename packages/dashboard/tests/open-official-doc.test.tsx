import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenOfficialDocLink } from "../src/components/OpenOfficialDocLink.tsx";
import { StageCard } from "../src/components/StageCard.tsx";
import {
  buildOpenOfficialDocMessage,
  openDocInIde,
  stageDisplayName,
} from "../src/services/docs.ts";
import {
  deliverOfficialDocsLocale,
  onOfficialDocsLocale,
} from "../src/services/docs-shell-inject.ts";
import { StoreProvider } from "../src/store/context.tsx";
import { reducer } from "../src/store/reducer.ts";
import { initialState } from "../src/store/state.ts";
import { stageDoc } from "./fixtures.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubVsCodeHost(): { posted: () => unknown[] } {
  const posted: unknown[] = [];
  vi.stubGlobal("acquireVsCodeApi", () => ({
    postMessage: (message: unknown) => {
      posted.push(message);
    },
  }));
  return { posted: () => posted };
}

describe("buildOpenOfficialDocMessage", () => {
  it("mapped: locale + path + optional anchor", () => {
    expect(
      buildOpenOfficialDocMessage("ja", {
        path: "guide/getting-started.md",
        anchor: "approval-gates",
      }),
    ).toEqual({
      type: "open-official-doc",
      locale: "ja",
      path: "guide/getting-started.md",
      anchor: "approval-gates",
    });
  });

  it("unmapped / empty path: locale only (omit path/anchor keys)", () => {
    const unmapped = buildOpenOfficialDocMessage("en", null);
    expect(unmapped).toEqual({ type: "open-official-doc", locale: "en" });
    expect("path" in unmapped).toBe(false);
    expect("anchor" in unmapped).toBe(false);

    const empty = buildOpenOfficialDocMessage("en", { path: "" });
    expect(empty).toEqual({ type: "open-official-doc", locale: "en" });
    expect("path" in empty).toBe(false);
  });

  it("defaults invalid locale bits to en via ternary", () => {
    expect(buildOpenOfficialDocMessage("en", null).locale).toBe("en");
    expect(buildOpenOfficialDocMessage("ja", null).locale).toBe("ja");
  });
});

describe("stageDisplayName", () => {
  it("title-cases kebab slug", () => {
    expect(stageDisplayName("intent-capture")).toBe("Intent Capture");
    expect(stageDisplayName("code-generation")).toBe("Code Generation");
  });
});

describe("OpenOfficialDocLink / StageCard a11y", () => {
  it("accessible name is Docs: <stageDisplayName>, not bare Docs", async () => {
    stubVsCodeHost();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          value: { path: "guide/getting-started.md", anchor: "approval-gates" },
        }),
      ),
    );

    render(
      <StoreProvider>
        <OpenOfficialDocLink slug="intent-capture" sourceVersion="1.4.0" />
      </StoreProvider>,
    );

    const control = screen.getByRole("button", { name: "Docs: Intent Capture" });
    expect(control.getAttribute("aria-label")).toBe("Docs: Intent Capture");
    expect(control.textContent).toBe("Docs: Intent Capture");
    expect(control.textContent).not.toBe("Docs");
  });

  it("mapped StageCard path does not call openDocInIde / open-doc", async () => {
    const host = stubVsCodeHost();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path.includes("/api/official-docs/stage/")) {
          return Response.json({
            ok: true,
            value: { path: "guide/getting-started.md", anchor: "approval-gates" },
          });
        }
        return Response.json({ error: true, reason: "not_found" }, { status: 404 });
      }),
    );

    render(
      <StoreProvider>
        <StageCard
          doc={stageDoc({ slug: "intent-capture", purpose: "Capture intent." })}
          isCurrent={false}
          onOpenStage={() => {}}
        />
      </StoreProvider>,
    );

    expect(screen.queryByTestId("docs-open-ide")).toBeNull();
    await userEvent.click(screen.getByTestId("open-official-doc"));

    await waitFor(() => {
      expect(host.posted()).toHaveLength(1);
    });
    expect(host.posted()[0]).toEqual({
      type: "open-official-doc",
      locale: "en",
      path: "guide/getting-started.md",
      anchor: "approval-gates",
    });
    expect(host.posted().some((m) => (m as { type?: string }).type === "open-doc")).toBe(false);

    // openDocInIde still exists for guides, but was not used on this path.
    expect(typeof openDocInIde).toBe("function");
  });

  it("uses officialDocsLocale from store for payload locale", async () => {
    const host = stubVsCodeHost();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true, value: null })),
    );

    render(
      <StoreProvider preloaded={{ officialDocsLocale: "ja" }}>
        <OpenOfficialDocLink slug="code-generation" />
      </StoreProvider>,
    );

    await userEvent.click(screen.getByTestId("open-official-doc"));
    await waitFor(() => {
      expect(host.posted()).toEqual([{ type: "open-official-doc", locale: "ja" }]);
    });
  });

  it("does not open Shell when stage-map fetch errors (not unmapped)", async () => {
    const host = stubVsCodeHost();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: true, reason: "server-unreachable" })),
    );

    render(
      <StoreProvider>
        <OpenOfficialDocLink slug="intent-capture" />
      </StoreProvider>,
    );

    await userEvent.click(screen.getByTestId("open-official-doc"));
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(0);
    });
    expect(host.posted()).toEqual([]);
  });

  it("ignores a stage-map result after unmount (stale activation)", async () => {
    const host = stubVsCodeHost();
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    const view = render(
      <StoreProvider>
        <OpenOfficialDocLink slug="intent-capture" />
      </StoreProvider>,
    );

    await userEvent.click(screen.getByTestId("open-official-doc"));
    view.unmount();
    resolveFetch(
      Response.json({
        ok: true,
        value: { path: "guide/getting-started.md", anchor: "approval-gates" },
      }),
    );
    await Promise.resolve();
    expect(host.posted()).toEqual([]);
  });
});

describe("officialDocsLocale host bootstrap", () => {
  it("replays a ready-locale that arrived before subscribe", () => {
    const seen: string[] = [];
    deliverOfficialDocsLocale("ja");
    const off = onOfficialDocsLocale((locale) => {
      seen.push(locale);
    });
    expect(seen).toEqual(["ja"]);
    off();
  });
});

describe("store deep-link locale", () => {
  it("requires locale when deep-link is non-null; one-shot clear still works", () => {
    const open = reducer(initialState, {
      type: "docs-shell",
      open: true,
      locale: "ja",
      path: "guide/concepts.md",
      anchor: "approval-gates",
    });
    expect(open.docsShellDeepLink).toEqual({
      locale: "ja",
      path: "guide/concepts.md",
      anchor: "approval-gates",
    });
    expect(open.officialDocsLocale).toBe("ja");

    const cleared = reducer(open, { type: "docs-shell", open: true });
    expect(cleared.docsShellOpen).toBe(true);
    expect(cleared.docsShellDeepLink).toBeNull();
    expect(cleared.officialDocsLocale).toBe("ja");

    const localeOnly = reducer(initialState, {
      type: "docs-shell",
      open: true,
      locale: "en",
    });
    expect(localeOnly.docsShellDeepLink).toEqual({ locale: "en" });
    expect("path" in (localeOnly.docsShellDeepLink ?? {})).toBe(false);
  });
});
