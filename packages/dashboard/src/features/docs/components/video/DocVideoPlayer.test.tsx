import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocVideoPlayer } from "./DocVideoPlayer.tsx";

const HASH = "d".repeat(64);
const STORYBOARD = {
  formatVersion: 1,
  page: "guide/04-phases-and-stages.md",
  sourceHash: HASH,
  title: "フェーズとステージ",
  chapters: [
    {
      id: "intro",
      title: "はじめに",
      template: "title",
      cues: [{ text: "流れを見ます。" }],
      data: { headline: "フェーズとステージ" },
    },
  ],
};
const TIMELINE = {
  formatVersion: 1,
  duration: 5,
  chapters: [{ id: "intro", start: 0, duration: 5, cues: [{ start: 1, end: 4 }] }],
};

/** A 2D context that accepts every call (jsdom has no canvas). */
function fakeContext(): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = {};
  return new Proxy(state, {
    get: (target, prop) =>
      prop in target
        ? target[prop]
        : prop === "measureText"
          ? (s: string) => ({ width: s.length * 10 })
          : () => undefined,
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

let play: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => fakeContext() as unknown as RenderingContext,
  );
  play = vi.fn(async () => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play as () => Promise<void>);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DocVideoPlayer", () => {
  it("mounts the Kamishibai player and starts the narration from the user's click", async () => {
    render(
      <DocVideoPlayer
        storyboard={STORYBOARD}
        timeline={TIMELINE}
        narrationUrl="webview:n.opus"
        autoStart
      />,
    );
    const root = screen.getByTestId("doc-video-player");
    await waitFor(() => expect(root.querySelector(".ksb canvas")).not.toBeNull());
    expect(play).toHaveBeenCalledOnce();
    expect(root.querySelector(".ksb-time")?.textContent).toBe("0:00 / 0:05");
  });

  it("does not play on its own without autoStart", async () => {
    render(
      <DocVideoPlayer
        storyboard={STORYBOARD}
        timeline={TIMELINE}
        narrationUrl="webview:n.opus"
        autoStart={false}
      />,
    );
    await waitFor(() => expect(document.querySelector(".ksb")).not.toBeNull());
    expect(play).not.toHaveBeenCalled();
  });

  it("removes the player and releases the audio on unmount", async () => {
    const { unmount } = render(
      <DocVideoPlayer
        storyboard={STORYBOARD}
        timeline={TIMELINE}
        narrationUrl="webview:n.opus"
        autoStart={false}
      />,
    );
    await waitFor(() => expect(document.querySelector(".ksb")).not.toBeNull());
    unmount();
    expect(document.querySelector(".ksb")).toBeNull();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("reports unreadable video data instead of drawing", async () => {
    render(
      <DocVideoPlayer
        storyboard={{}}
        timeline={{}}
        narrationUrl="webview:n.opus"
        autoStart={false}
      />,
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "動画データを読み込めませんでした",
    );
  });

  it("reports a storyboard the templates cannot draw", async () => {
    const broken = { ...STORYBOARD, chapters: [{ ...STORYBOARD.chapters[0], data: {} }] };
    render(
      <DocVideoPlayer
        storyboard={broken}
        timeline={TIMELINE}
        narrationUrl="webview:n.opus"
        autoStart={false}
      />,
    );
    expect((await screen.findByRole("alert")).textContent).toContain("headline");
  });

  it("reports a host that cannot draw at all", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(
      <DocVideoPlayer
        storyboard={STORYBOARD}
        timeline={TIMELINE}
        narrationUrl="webview:n.opus"
        autoStart={false}
      />,
    );
    expect((await screen.findByRole("alert")).textContent).toContain("描画できません");
  });

  it("reports narration that will not load or play", async () => {
    play.mockRejectedValueOnce(new Error("NotAllowedError"));
    render(
      <DocVideoPlayer
        storyboard={STORYBOARD}
        timeline={TIMELINE}
        narrationUrl="webview:n.opus"
        autoStart
      />,
    );
    expect((await screen.findByRole("alert")).textContent).toContain("再生できませんでした");
    document.querySelector("audio")?.dispatchEvent(new Event("error"));
  });

  it("reports a narration file that fails to load", async () => {
    const created: HTMLAudioElement[] = [];
    const original = Document.prototype.createElement;
    vi.spyOn(Document.prototype, "createElement").mockImplementation(function (
      this: Document,
      tag: string,
      options?: ElementCreationOptions,
    ) {
      const el = original.call(this, tag, options);
      if (tag === "audio") created.push(el as HTMLAudioElement);
      return el;
    });
    render(
      <DocVideoPlayer
        storyboard={STORYBOARD}
        timeline={TIMELINE}
        narrationUrl="webview:n.opus"
        autoStart={false}
      />,
    );
    await waitFor(() => expect(created).toHaveLength(1));
    created[0]?.dispatchEvent(new Event("error"));
    expect((await screen.findByRole("alert")).textContent).toContain("音声を読み込めませんでした");
  });
});
