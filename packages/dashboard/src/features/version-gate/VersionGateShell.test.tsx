import type { OfficialDocsManifest, OfficialDocsToc, VersionGate } from "@aidlc-guide/shared-types";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App.tsx";
import { fetchMatrix } from "@/services/api.ts";
import { getTransport, setTransport } from "@/services/transport/index.ts";
import { onVersionGate, versionGateOf } from "@/services/version-gate.ts";
import { matrix, payload } from "@tests/fixtures.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function gate(overrides: Partial<VersionGate> = {}): VersionGate {
  return {
    status: "project-older",
    target: "2.11.0",
    tools: [
      { id: "claude", label: "Claude Code", version: "2.10.0" },
      { id: "cursor", label: "Cursor", version: "2.10.0" },
    ],
    pin: "2.10.0",
    engine: null,
    native: false,
    message:
      "プロジェクトの aidlc-workflows 2.10.0 は、この Guide の対応版 2.11.0 より古いバージョンです。",
    ...overrides,
  };
}

function refusal(value: VersionGate = gate()) {
  return { error: true as const, reason: "version-gate", detail: value.message, gate: value };
}

/** A server that refuses everything but bundled docs until `unblock()` is called. */
function stubServer(initial: VersionGate = gate()) {
  let blocked: VersionGate | null = initial;
  const fetchMock = vi.fn(async (input: string) => {
    if (input === "/api/official-docs/manifest") {
      const value: OfficialDocsManifest = {
        sourceVersion: "aidlc 2.11.0",
        source: "aidlc-workflows",
        capturedAt: "2026-10-09T00:00:00.000Z",
      };
      return Response.json({ ok: true, value });
    }
    if (input.startsWith("/api/official-docs/toc/")) {
      const value: OfficialDocsToc = {
        overview: [],
        guide: [],
        "harness-engineering": [],
        reference: [],
        rfcs: [],
      };
      return Response.json({ ok: true, value });
    }
    if (input === "/api/guides") return Response.json({ ok: true, value: [] });
    if (input === "/api/docs-settings") return Response.json({ ok: true, value: {} });
    if (blocked !== null) return Response.json(refusal(blocked), { status: 409 });
    if (input === "/api/workflow") return Response.json(payload());
    if (input.includes("/api/matrix")) return Response.json({ ok: true, value: matrix() });
    return Response.json({ error: true, reason: "not_found" }, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "WebSocket",
    class {
      close(): void {}
    },
  );
  return {
    fetchMock,
    unblock: () => {
      blocked = null;
    },
    block: (value: VersionGate) => {
      blocked = value;
    },
  };
}

describe("versionGateOf", () => {
  it("reads the gate from a refusal and ignores anything else", () => {
    expect(versionGateOf(refusal())).toEqual(gate());
    expect(versionGateOf({ error: true, reason: "not-found" })).toBeNull();
    expect(
      versionGateOf({ error: true, reason: "version-gate", gate: { status: "x" } }),
    ).toBeNull();
    expect(versionGateOf(null)).toBeNull();
    expect(versionGateOf({ ok: true, value: {} })).toBeNull();
  });
});

describe("version gate reports", () => {
  it("hears a refusal from a POST as well as a GET, whichever reaches the server first", async () => {
    const previous = (() => {
      try {
        return getTransport();
      } catch {
        return null;
      }
    })();
    const heard: VersionGate[] = [];
    const stop = onVersionGate((value) => heard.push(value));
    try {
      setTransport({
        getJson: async () => ({ reached: true, body: refusal(gate({ status: "project-newer" })) }),
        postJson: async () => ({ ok: false, status: 409, body: refusal() }),
        subscribe: () => () => {},
      });
      await getTransport().postJson("/api/answer", {});
      expect(heard.map((value) => value.status)).toEqual(["project-older"]);
      await getTransport().getJson("/api/workflow");
      expect(heard.map((value) => value.status)).toEqual(["project-older", "project-newer"]);
    } finally {
      stop();
      if (previous) setTransport(previous);
    }
  });
});

describe("version gate screen", () => {
  it("replaces the dashboard when the bootstrap read is refused", async () => {
    stubServer();
    render(<App bootstrap={Promise.resolve(refusal())} />);

    const notice = await screen.findByTestId("version-gate");
    expect(notice.dataset.status).toBe("project-older");
    expect(within(notice).getByRole("heading").textContent).toBe("プロジェクトの更新が必要です");
    expect(within(notice).getByRole("status").textContent).toContain("2.10.0");
    expect(within(notice).getByLabelText("バージョン").textContent).toContain("Claude Code");
    expect(screen.queryByTestId("now-current-stage")).toBeNull();
    // A browser has nothing to run the update with; it says where to go instead.
    expect(screen.queryByTestId("version-gate-action")).toBeNull();
    expect(notice.textContent).toContain("VS Code / Cursor の AIDLC Guide から行います");
  });

  it("keeps the bundled docs readable without starting document questions", async () => {
    const { fetchMock } = stubServer();
    const user = userEvent.setup();
    render(<App bootstrap={Promise.resolve(refusal())} />);

    await user.click(await screen.findByRole("button", { name: "ドキュメントを読む" }));
    expect(await screen.findByTestId("docs-questions-gated")).toBeTruthy();
    expect(screen.queryByTestId("version-gate")).toBeNull();
    const paths = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(paths.some((path) => path.startsWith("/api/docs-qa/"))).toBe(false);

    await user.click(screen.getByRole("button", { name: "更新の案内" }));
    expect(await screen.findByTestId("version-gate")).toBeTruthy();
  });

  it("offers the one action for the situation inside VS Code", async () => {
    const mismatch = gate({ status: "engine-mismatch", native: true });
    stubServer(mismatch);
    const postMessage = vi.fn();
    vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
    const user = userEvent.setup();
    render(<App bootstrap={Promise.resolve(refusal(mismatch))} />);

    const action = await screen.findByTestId("version-gate-action");
    expect(action.textContent).toBe("この PC に 2.11.0 を導入");
    expect(
      screen.getByText("共有するファイルは変わりません。この PC だけに導入します。"),
    ).toBeTruthy();
    expect(screen.getByLabelText("バージョン").textContent).toContain("未導入");
    await user.click(action);
    expect(postMessage).toHaveBeenCalledWith({
      type: "version-gate-action",
      action: "install-engine",
    });
  });

  it.each([
    ["project-older", "プロジェクトを 2.11.0 に更新"],
    ["project-newer", "AIDLC Guide を更新"],
    ["unknown", "Doctor で診断"],
    ["not-installed", "セットアップを開く"],
  ] as const)("labels the %s action", async (status, label) => {
    stubServer(gate({ status }));
    vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage: vi.fn() }));
    render(<App bootstrap={Promise.resolve(refusal(gate({ status })))} />);
    expect((await screen.findByTestId("version-gate-action")).textContent).toBe(label);
  });

  it("returns to a fresh dashboard once a re-check passes", async () => {
    const server = stubServer();
    const user = userEvent.setup();
    render(<App bootstrap={Promise.resolve(refusal())} />);

    await screen.findByTestId("version-gate");
    server.unblock();
    await user.click(screen.getByRole("button", { name: "状態を再確認" }));
    await waitFor(() => {
      expect(screen.getByTestId("now-current-stage").textContent).toBe("code-generation");
    });
    expect(screen.queryByTestId("version-gate")).toBeNull();
  });

  it("stays blocked when the re-check is still refused", async () => {
    const server = stubServer();
    const user = userEvent.setup();
    render(<App bootstrap={Promise.resolve(refusal())} />);

    await screen.findByTestId("version-gate");
    server.block(gate({ status: "project-newer" }));
    await user.click(screen.getByRole("button", { name: "状態を再確認" }));
    await waitFor(() => {
      expect(screen.getByTestId("version-gate").dataset.status).toBe("project-newer");
    });
  });

  it("keeps the update screen when the re-check cannot reach the server", async () => {
    const server = stubServer();
    const user = userEvent.setup();
    render(<App bootstrap={Promise.resolve(refusal())} />);

    await screen.findByTestId("version-gate");
    server.fetchMock.mockImplementation(async () => {
      throw new TypeError("connection refused");
    });
    await user.click(screen.getByRole("button", { name: "状態を再確認" }));
    await waitFor(() => {
      expect(server.fetchMock).toHaveBeenCalledWith("/api/workflow", expect.anything());
    });
    expect(screen.getByTestId("version-gate")).toBeTruthy();
    expect(screen.queryByTestId("now-current-stage")).toBeNull();
  });

  it("re-checks when the window regains focus", async () => {
    const server = stubServer();
    render(<App bootstrap={Promise.resolve(refusal())} />);
    await screen.findByTestId("version-gate");
    server.unblock();
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => {
      expect(screen.queryByTestId("version-gate")).toBeNull();
    });
  });

  it("blocks a running dashboard as soon as a later read is refused", async () => {
    const server = stubServer();
    server.unblock();
    render(<App bootstrap={Promise.resolve({ ok: true as const, value: payload() })} />);
    await waitFor(() => {
      expect(screen.getByTestId("now-current-stage").textContent).toBe("code-generation");
    });

    server.block(gate({ status: "project-newer" }));
    // Any read reaching the server again (the timings poll, a click) is refused.
    await fetchMatrix();
    const notice = await screen.findByTestId("version-gate");
    expect(notice.dataset.status).toBe("project-newer");
  });
});
