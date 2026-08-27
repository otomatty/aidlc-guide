import type { IntentList } from "@aidlc-guide/shared-types";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app/App.tsx";
import { IntentPicker } from "../src/components/IntentPicker.tsx";
import { NowStrip } from "../src/components/NowStrip.tsx";
import { fetchIntents } from "../src/services/api.ts";
import { StoreProvider } from "../src/store/context.tsx";
import { matrix, payload, workflow } from "./fixtures.ts";

/**
 * US-15 一覧導線. The list is *informational*: this package must never grow a
 * control that switches the active intent, because that is a write (NFR-1).
 */

const INTENTS: IntentList = {
  space: "default",
  active: "260101-guide",
  all: ["251201-spike", "260101-guide"],
  selected: "260101-guide",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubApi(intentsBody: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: string) => {
    if (input.includes("/api/intents")) return new Response(JSON.stringify(intentsBody));
    if (input.includes("/api/matrix")) {
      return new Response(JSON.stringify({ ok: true, value: matrix() }));
    }
    if (input.includes("/api/links")) return new Response(JSON.stringify({ ok: true, value: [] }));
    return new Response(JSON.stringify(payload()));
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "WebSocket",
    class {
      close(): void {}
    },
  );
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

describe("fetchIntents", () => {
  it("reads the list over GET and passes the ReadResult through", async () => {
    const fetchMock = stubApi({ ok: true, value: INTENTS });
    expect(await fetchIntents()).toEqual({ ok: true, value: INTENTS });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/intents");
    // GET only: no init object of ours ever names a method.
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty("method");
  });

  it("reports a dead server as unreachable rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    expect(await fetchIntents()).toEqual({ error: true, reason: "server-unreachable" });
  });
});

describe("IntentPicker", () => {
  it("opens a dialog that lists every intent and marks the active one", async () => {
    render(
      <StoreProvider preloaded={{ intents: { kind: "success", value: INTENTS } }}>
        <IntentPicker />
      </StoreProvider>,
    );
    expect(screen.queryByTestId("intent-dialog")).toBeNull();
    await userEvent.click(screen.getByTestId("intent-picker-trigger"));
    const dialog = screen.getByRole("dialog", { name: "インテント一覧" });
    const items = within(dialog).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "○ 251201-spike",
      "✔ 260101-guide（アクティブ）",
    ]);
    expect(items[1]?.getAttribute("data-active")).toBe("true");
  });

  it("names the command instead of offering a switch control", async () => {
    render(
      <StoreProvider preloaded={{ intents: { kind: "success", value: INTENTS } }}>
        <IntentPicker />
      </StoreProvider>,
    );
    await userEvent.click(screen.getByTestId("intent-picker-trigger"));
    const dialog = screen.getByTestId("intent-dialog");
    expect(dialog.textContent).toContain("/aidlc intent <名前>");
    // List is informational: no select/combobox/option that would write active-intent.
    expect(within(dialog).queryByRole("combobox")).toBeNull();
    expect(within(dialog).queryByRole("option")).toBeNull();
    expect(within(dialog).getAllByRole("listitem")[0]?.tagName).toBe("LI");
  });

  it("falls back to the state file's project name while the list is loading", () => {
    render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflow() } }}>
        <IntentPicker />
      </StoreProvider>,
    );
    expect(screen.getByTestId("intent-picker").textContent).toContain("aidlc-guide");
  });

  it("opens the dialog unprompted when nothing is active but intents exist", () => {
    render(
      <StoreProvider
        preloaded={{
          intents: {
            kind: "success",
            value: { space: "default", active: null, all: ["a", "b"], selected: null },
          },
        }}
      >
        <IntentPicker />
      </StoreProvider>,
    );
    expect(screen.getByRole("dialog", { name: "インテント一覧" })).toBeDefined();
    expect(within(screen.getByTestId("intent-list")).getByText("a")).toBeDefined();
  });
});

describe("empty state (US-15 AC)", () => {
  it("says nothing is active, lists what exists and gives the command", () => {
    render(
      <StoreProvider
        preloaded={{
          intents: {
            kind: "success",
            value: { space: "default", active: null, all: ["251201-spike"], selected: null },
          },
        }}
      >
        <NowStrip
          state={{ kind: "empty", hint: "アクティブなインテントがありません" }}
          onRetry={() => {}}
          intentPicker={<IntentPicker />}
        />
      </StoreProvider>,
    );

    const alert = screen.getByRole("alert", { hidden: true });
    expect(within(alert).getByText("ワークフローはまだありません")).toBeDefined();
    expect(within(alert).getByText("アクティブなインテントがありません")).toBeDefined();
    // Auto-opens the list dialog when nothing is active.
    expect(screen.getByRole("dialog", { name: "インテント一覧" })).toBeDefined();
    expect(within(screen.getByTestId("intent-list")).getByText("251201-spike")).toBeDefined();
    expect(alert.textContent).toContain("/aidlc intent <名前>");
    // The old copy promised a selection this tool cannot make.
    expect(alert.textContent).not.toContain("別のインテントを選択");
  });
});

describe("degradation (BR-UI-4)", () => {
  it("renders the rest of the app when the intents payload is unusable", async () => {
    stubApi({ error: true, reason: "state-unreadable" });
    render(<App bootstrap={Promise.resolve({ ok: true as const, value: payload() })} />);

    await waitFor(() => {
      expect(screen.getByTestId("done-total").textContent).toBe("3 / 6");
    });
    expect(screen.getByTestId("stage-rail-item-code-generation")).toBeDefined();
    // Degraded slice, healthy header: the project name still carries the label.
    expect(screen.getByTestId("intent-picker").textContent).toContain("aidlc-guide");
  });
});
