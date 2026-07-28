import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserTransport } from "../src/services/transport/browser.ts";
import { GET_TIMEOUT_MS } from "../src/services/transport/types.ts";
import { createVscodeTransport } from "../src/services/transport/vscode.ts";

/**
 * Codex review on PR #18: neither transport bounded a GET. A `fetch` against a
 * wedged connection has no timeout of its own, and the VS Code transport
 * resolves only on a matching `get-response`, so a stranded extension host
 * left the resolver in `pendingGet` for the life of the webview. The dashboard
 * polls `/api/timings` every 30s whether or not the last answer arrived, which
 * turned one stalled read into an accumulating one.
 */

describe("browser transport GET deadline", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cancels the request rather than racing it, and reports unreachable", async () => {
    // The signal is the point: a `Promise.race` would leave the request
    // running with its connection held. Reject the way an abort does.
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_path: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        throw new DOMException("The operation was aborted.", "TimeoutError");
      }),
    );

    const result = await createBrowserTransport().getJson("/api/timings");

    expect(signal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({ reached: false });
  });

  it("passes a signal that is not already aborted on a healthy read", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_path: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Response(JSON.stringify({ ok: true, value: 1 }));
      }),
    );

    const result = await createBrowserTransport().getJson("/api/timings");

    expect(signal?.aborted).toBe(false);
    expect(result).toEqual({ reached: true, body: { ok: true, value: 1 } });
  });
});

/**
 * The webview half. `acquireVsCodeApi` is stubbed onto the window the way the
 * host injects it, and `postMessage` is captured so a test can answer — or
 * deliberately never answer — a specific request id.
 */
function stubWebview(): { posted: Record<string, unknown>[] } {
  const posted: Record<string, unknown>[] = [];
  vi.stubGlobal("acquireVsCodeApi", () => ({
    postMessage: (message: Record<string, unknown>) => {
      posted.push(message);
    },
    getState: () => undefined,
    setState: () => undefined,
  }));
  return { posted };
}

/** Deliver a host reply the way the webview receives it. */
function reply(message: Record<string, unknown>): void {
  window.dispatchEvent(new MessageEvent("message", { data: message }));
}

describe("vscode transport GET deadline", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("settles as unreachable when the extension host never answers", async () => {
    vi.useFakeTimers();
    stubWebview();
    const transport = createVscodeTransport();

    const pending = transport.getJson("/api/timings");
    await vi.advanceTimersByTimeAsync(GET_TIMEOUT_MS - 1);

    let settled: unknown;
    void pending.then((value) => {
      settled = value;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBeUndefined(); // still waiting, correctly

    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ reached: false });
  });

  it("drops the pending resolver, so a late answer changes nothing", async () => {
    vi.useFakeTimers();
    const { posted } = stubWebview();
    const transport = createVscodeTransport();

    const pending = transport.getJson("/api/timings");
    const id = (posted.find((message) => message.type === "get")?.id ?? "") as string;
    expect(id).not.toBe("");

    await vi.advanceTimersByTimeAsync(GET_TIMEOUT_MS);
    expect(await pending).toEqual({ reached: false });

    // The host finally answers the request we gave up on. Nothing is left to
    // resolve — this must be a no-op rather than a second settle or a throw.
    expect(() => {
      reply({ type: "get-response", id, reached: true, body: { ok: true } });
    }).not.toThrow();
    expect(await pending).toEqual({ reached: false });
  });

  it("answers normally, and clears the deadline, when the host does reply", async () => {
    vi.useFakeTimers();
    const { posted } = stubWebview();
    const transport = createVscodeTransport();

    const pending = transport.getJson("/api/workflow");
    const id = posted.find((message) => message.type === "get")?.id as string;
    reply({ type: "get-response", id, reached: true, body: { ok: true, value: 7 } });

    expect(await pending).toEqual({ reached: true, body: { ok: true, value: 7 } });

    // Past the deadline the answered request must stay answered.
    await vi.advanceTimersByTimeAsync(GET_TIMEOUT_MS * 2);
    expect(await pending).toEqual({ reached: true, body: { ok: true, value: 7 } });
  });
});
