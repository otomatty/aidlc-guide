import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "../src/components/Header.tsx";
import { NextStepCallout } from "../src/components/NextStepCallout.tsx";
import { StoreProvider } from "../src/store/context.tsx";
import { nextStep, workflow } from "./fixtures.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubLinks(value: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, value })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

describe("Header (BLM step 7)", () => {
  it("fetches project links after first paint and renders the safe ones", async () => {
    const fetchMock = stubLinks([
      { label: "リポジトリ", target: "https://example.com/repo" },
      { label: "設計", target: "docs/design.md" },
      { label: "危険", target: "javascript:alert(1)" },
    ]);

    render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflow() } }}>
        <Header />
      </StoreProvider>,
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/links", expect.anything());
    });

    const external = await screen.findByRole("link", { name: "リポジトリ" });
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toBe("noopener noreferrer");

    const local = screen.getByRole("link", { name: "設計" });
    expect(local.getAttribute("target")).toBeNull();
    // S-UI-4: a non-http(s) scheme never becomes a link.
    expect(screen.queryByRole("link", { name: "危険" })).toBeNull();
  });

  it("shows the read-only badge only in --host mode", () => {
    stubLinks([]);
    const { unmount } = render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflow() } }}>
        <Header />
      </StoreProvider>,
    );
    expect(screen.queryByTestId("read-only-badge")).toBeNull();
    unmount();

    render(
      <StoreProvider
        preloaded={{ workflow: { kind: "success", value: workflow() }, hostMode: true }}
      >
        <Header />
      </StoreProvider>,
    );
    expect(screen.getByTestId("read-only-badge").getAttribute("role")).toBe("status");
  });

  it("names the active intent in the picker", () => {
    stubLinks([]);
    render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflow() } }}>
        <Header />
      </StoreProvider>,
    );
    expect(screen.getByTestId("intent-picker").textContent).toContain("aidlc-guide");
  });

  it("exposes the in-app guides entry", () => {
    stubLinks([]);
    render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflow() } }}>
        <Header />
      </StoreProvider>,
    );
    expect(screen.getByTestId("guides-open").textContent).toContain("使い方");
  });
});

describe("NextStepCallout navigation", () => {
  it("hands the next slug back to the caller", async () => {
    const onOpenNext = vi.fn();
    render(<NextStepCallout nextStep={nextStep()} onOpenNext={onOpenNext} />);
    await userEvent.click(screen.getByRole("button", { name: /その解説を見る/ }));
    expect(onOpenNext).toHaveBeenCalledWith("build-and-test");
  });
});
