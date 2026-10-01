import { describe, expect, it, vi } from "vitest";
import { createGrokTts, createToneTts, estimateGrokCostUsd, TtsError } from "../src/tts.ts";

const KEY = "xai-secret-key";
const REQUEST = { text: "こんにちは", voice: "eve", language: "ja" };

function audioResponse(bytes = [1, 2, 3]): Response {
  return new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": "audio/mpeg" } });
}

function setup(...responses: (Response | Error)[]) {
  const queue = [...responses];
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const next = queue.shift();
    if (next === undefined) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = vi.fn(async (_ms: number) => {});
  const tts = createGrokTts({ apiKey: KEY, fetch: fetch as unknown as typeof globalThis.fetch, sleep });
  return { tts, fetch, sleep };
}

describe("createGrokTts", () => {
  it("posts the caption with the voice and language and returns the audio", async () => {
    const { tts, fetch } = setup(audioResponse([9, 8]));
    expect(tts.id).toBe("grok");
    expect(await tts.synthesize(REQUEST)).toEqual(new Uint8Array([9, 8]));
    const call = fetch.mock.calls[0];
    if (call === undefined) throw new Error("not called");
    const [url, init] = call;
    expect(url).toBe("https://api.x.ai/v1/tts");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(init?.body))).toEqual({ text: "こんにちは", voice_id: "eve", language: "ja" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("backs off 1, 2, 4… seconds on rate limits and server errors", async () => {
    const { tts, sleep } = setup(
      new Response("", { status: 429 }),
      new Response("", { status: 503 }),
      audioResponse(),
    );
    await tts.synthesize(REQUEST);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it("honours Retry-After when the server sends one", async () => {
    const { tts, sleep } = setup(
      new Response("", { status: 429, headers: { "retry-after": "7" } }),
      new Response("", { status: 429, headers: { "retry-after": "9999" } }),
      audioResponse(),
    );
    await tts.synthesize(REQUEST);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([7000, 2000]);
  });

  it("retries network failures, then gives up", async () => {
    const offline = new Error("ECONNRESET");
    const { tts, fetch } = setup(offline, offline, offline, offline, offline, offline);
    await expect(tts.synthesize(REQUEST)).rejects.toThrow(/unreachable: ECONNRESET/);
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it("gives up after five retries of a transient error", async () => {
    const { tts, fetch } = setup(...Array.from({ length: 6 }, () => new Response("busy", { status: 500 })));
    await expect(tts.synthesize(REQUEST)).rejects.toThrow("HTTP 500 — busy");
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it("fails at once on a client error, without echoing the key", async () => {
    const { tts, fetch } = setup(new Response("invalid voice_id", { status: 400 }));
    const error = await tts.synthesize(REQUEST).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TtsError);
    expect(String(error)).toContain("HTTP 400 — invalid voice_id");
    expect(String(error)).not.toContain(KEY);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("redacts the key from anything echoed back by the server or the network", async () => {
    const echoed = setup(new Response(`bad request: Authorization: Bearer ${KEY} key=${KEY}`, { status: 400 }));
    const fromServer = String(await echoed.tts.synthesize(REQUEST).catch((e: unknown) => e));
    expect(fromServer).not.toContain(KEY);
    expect(fromServer).toContain("Bearer [redacted]");
    expect(fromServer).toContain("key=[redacted]");
    const leaky = new Error(`proxy refused request with token ${KEY}`);
    const offline = setup(leaky, leaky, leaky, leaky, leaky, leaky);
    const fromNetwork = String(await offline.tts.synthesize(REQUEST).catch((e: unknown) => e));
    expect(fromNetwork).not.toContain(KEY);
    expect(fromNetwork).toContain("[redacted]");
  });

  it("reports a client error with no body", async () => {
    const { tts } = setup(new Response(null, { status: 401 }));
    await expect(tts.synthesize(REQUEST)).rejects.toThrow(/HTTP 401$/);
  });

  it("treats an empty answer as a failure", async () => {
    const { tts } = setup(audioResponse([]));
    await expect(tts.synthesize(REQUEST)).rejects.toThrow(/no audio/);
  });

  it("refuses to start without a key", () => {
    expect(() => createGrokTts({ apiKey: " " })).toThrow(/XAI_API_KEY/);
  });

  it("uses the global fetch and a real timer by default", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    vi.useFakeTimers();
    try {
      const pending = createGrokTts({ apiKey: KEY }).synthesize(REQUEST).catch((e: unknown) => e);
      await vi.runAllTimersAsync();
      expect(String(await pending)).toContain("HTTP 503");
    } finally {
      vi.useRealTimers();
      globalThis.fetch = original;
    }
  });
});

describe("estimateGrokCostUsd", () => {
  it("prices characters at $15 per million", () => {
    expect(estimateGrokCostUsd(1_000_000)).toBe(15);
    expect(estimateGrokCostUsd(1000)).toBeCloseTo(0.015);
  });
});

describe("createToneTts", () => {
  it("renders a tone as long as the estimated reading, at least half a second", async () => {
    const render = vi.fn((seconds: number) => new Uint8Array([seconds]));
    const tone = createToneTts(render, (text) => text.length);
    expect(tone.id).toBe("tone");
    await tone.synthesize({ ...REQUEST, text: "abc" });
    await tone.synthesize({ ...REQUEST, text: "" });
    expect(render.mock.calls.map((c) => c[0])).toEqual([3, 0.5]);
  });
});
