import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeTransport } from "@/services/transport/vscode.ts";
import { onVideoPacksChanged } from "@/services/video-packs-inject.ts";

afterEach(() => vi.unstubAllGlobals());

describe("video pack changes from the host", () => {
  it("reach every listener until it unsubscribes", () => {
    vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage: () => {} }));
    createVscodeTransport();
    const listener = vi.fn();
    const stop = onVideoPacksChanged(listener);
    window.dispatchEvent(new MessageEvent("message", { data: { type: "video-packs-changed" } }));
    expect(listener).toHaveBeenCalledOnce();
    stop();
    window.dispatchEvent(new MessageEvent("message", { data: { type: "video-packs-changed" } }));
    expect(listener).toHaveBeenCalledOnce();
  });
});
