import type { IntentList } from "@aidlc-guide/shared-types";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app/App.tsx";
import { IntentPicker } from "../src/components/IntentPicker.tsx";
import { NowStrip } from "../src/components/NowStrip.tsx";
import { fetchIntents } from "../src/services/api.ts";
import { createBrowserTransport, setTransport } from "../src/services/transport/index.ts";
import { StoreProvider } from "../src/store/context.tsx";
import { matrix, payload, workflow } from "./fixtures.ts";

const INTENTS: IntentList = {
  space: "default",
  active: "260101-guide",
  all: ["251201-spike", "260101-guide"],
  selected: "260101-guide",
};

afterEach(() => {
  vi.unstubAllGlobals();
  setTransport(createBrowserTransport());
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
  it("opens a dialog that lists every intent and marks the selected one", async () => {
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
      "✔ 260101-guide（表示中）",
    ]);
    expect(items[1]?.getAttribute("data-selected")).toBe("true");
  });

  it("posts the chosen intent", async () => {
    const posted: unknown[] = [];
    setTransport({
      getJson: async (path) => {
        if (path.includes("/api/matrix")) {
          return { reached: true, body: { ok: true, value: matrix() } };
        }
        if (path.includes("/api/intents")) {
          return { reached: true, body: { ok: true, value: INTENTS } };
        }
        return { reached: true, body: { ok: true, value: payload() } };
      },
      postJson: async (path, body) => {
        posted.push({ path, body });
        return { ok: true, status: 200, body: { ok: true, value: INTENTS } };
      },
      subscribe: () => () => {},
    });
    render(
      <StoreProvider preloaded={{ intents: { kind: "success", value: INTENTS } }}>
        <IntentPicker />
      </StoreProvider>,
    );
    await userEvent.click(screen.getByTestId("intent-picker-trigger"));
    await userEvent.click(screen.getByRole("button", { name: /251201-spike/ }));
    expect(posted).toEqual([{ path: "/api/select-intent", body: { intent: "251201-spike" } }]);
  });

  it("does not offer buttons in hostMode", async () => {
    render(
      <StoreProvider preloaded={{ hostMode: true, intents: { kind: "success", value: INTENTS } }}>
        <IntentPicker />
      </StoreProvider>,
    );
    await userEvent.click(screen.getByTestId("intent-picker-trigger"));
    const dialog = screen.getByTestId("intent-dialog");
    expect(within(dialog).queryAllByRole("button", { name: /spike|guide/ })).toHaveLength(0);
    expect(dialog.textContent).toContain("表示の切替はドライバー側から");
  });

  it("shows 未選択 while the list is loading", () => {
    render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflow() } }}>
        <IntentPicker />
      </StoreProvider>,
    );
    expect(screen.getByTestId("intent-picker").textContent).toContain("未選択");
  });

  it("opens the dialog unprompted when nothing is selected but intents exist", () => {
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
  it("asks the user to pick when records exist but none is selected", () => {
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
          state={{
            kind: "empty",
            hint: "インテントを選んでください",
            reason: "no-selected-intent",
          }}
          onRetry={() => {}}
          intentPicker={<IntentPicker />}
        />
      </StoreProvider>,
    );

    const alert = screen.getByRole("alert", { hidden: true });
    expect(within(alert).getAllByText("インテントを選んでください").length).toBeGreaterThan(0);
    expect(alert.textContent).not.toContain("ワークフローはまだありません");
    expect(alert.textContent).not.toContain("/aidlc intent");
    expect(screen.getByRole("dialog", { name: "インテント一覧" })).toBeDefined();
    expect(within(screen.getByTestId("intent-list")).getByText("251201-spike")).toBeDefined();
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
    expect(screen.getByTestId("intent-picker").textContent).toContain("未選択");
  });
});
