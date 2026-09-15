import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  serve: vi.fn(),
}));
vi.mock("@aidlc-guide/api-core", () => ({
  acceptsCustomizationOrigin: vi.fn(),
  createGuideService: mocks.create,
  handlePost: vi.fn(),
  handleRead: vi.fn(),
  HOST_EXPOSURE_WARNING: "",
}));

import { serve } from "../src/server.ts";

function deferred() {
  let resolve = () => {};
  let reject = (_error: Error) => {};
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("Bun", { serve: mocks.serve });
});
afterEach(() => vi.unstubAllGlobals());

describe("server shutdown", () => {
  it("stops the listener immediately and waits for AI closure, including repeated stop calls", async () => {
    const ai = deferred();
    const network = deferred();
    const close = vi.fn(() => ai.promise);
    const stop = vi.fn(() => network.promise);
    const unwatch = vi.fn();
    const disposeDocs = vi.fn();
    mocks.create.mockReturnValue({
      startMatrixBackground: vi.fn(),
      startWatch: () => unwatch,
      docsQa: { dispose: disposeDocs },
      customizationAi: { close },
    });
    mocks.serve.mockReturnValue({ port: 4700, hostname: "127.0.0.1", stop });
    const running = await serve({ port: 0, host: false });
    const stopping = running.stop();
    expect(running.stop()).toBe(stopping);
    expect(stop).toHaveBeenCalledExactlyOnceWith(true);
    expect(unwatch).toHaveBeenCalledOnce();
    expect(disposeDocs).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    let settled = false;
    void stopping.then(() => {
      settled = true;
    });
    network.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    ai.resolve();
    await stopping;
    expect(settled).toBe(true);
  });

  it("waits for network shutdown and propagates an AI close failure", async () => {
    const network = deferred();
    const failure = new Error("AI shutdown timed out");
    const stop = vi.fn(() => network.promise);
    mocks.create.mockReturnValue({
      startMatrixBackground: vi.fn(),
      startWatch: () => vi.fn(),
      customizationAi: { close: vi.fn().mockRejectedValue(failure) },
    });
    mocks.serve.mockReturnValue({ port: 4700, hostname: "127.0.0.1", stop });
    const running = await serve({ port: 0, host: false });
    const stopping = running.stop();
    const failed = expect(stopping).rejects.toBe(failure);
    let settled = false;
    void stopping.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(stop).toHaveBeenCalledExactlyOnceWith(true);
    expect(settled).toBe(false);
    network.resolve();
    await failed;
  });

  it("preserves both AI and network errors", async () => {
    const aiFailure = new Error("AI shutdown timed out");
    const networkFailure = new Error("listener failed");
    mocks.create.mockReturnValue({
      startMatrixBackground: vi.fn(),
      startWatch: () => vi.fn(),
      customizationAi: { close: vi.fn().mockRejectedValue(aiFailure) },
    });
    mocks.serve.mockReturnValue({
      port: 4700,
      hostname: "127.0.0.1",
      stop: vi.fn().mockRejectedValue(networkFailure),
    });
    const running = await serve({ port: 0, host: false });
    await expect(running.stop()).rejects.toMatchObject({ errors: [aiFailure, networkFailure] });
  });
});
