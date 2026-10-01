// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Clock } from "../src/clock.ts";
import { Playback } from "../src/playback.ts";
import { formatClock, Player } from "../src/player.ts";
import { Stage } from "../src/stage.ts";
import { setTextMeasurer } from "../src/text-layout.ts";
import { emMeasurer, fakeContext } from "./fake-canvas.ts";

class ManualClock implements Clock {
  currentTime = 0;
  paused = true;
  ended = false;
  playbackRate = 1;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  seek = vi.fn((t: number) => {
    this.currentTime = t;
  });
}

function mount() {
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getContext").mockReturnValue(fakeContext() as unknown as RenderingContext);
  const stage = new Stage(canvas);
  stage.scene("one", { duration: 10, title: "第1章" });
  stage.scene("two", { duration: 10, title: "第2章" });
  stage.scene("three", { duration: 10, title: "第3章" });
  const clock = new ManualClock();
  const playback = new Playback(stage, clock, { request: () => 1, cancel: () => {} });
  const host = document.createElement("div");
  document.body.append(host);
  const player = new Player(playback, host);
  const q = <T extends Element>(sel: string) => host.querySelector<T>(sel) as T;
  return { canvas, stage, clock, playback, player, host, q };
}

describe("Player", () => {
  beforeEach(() => setTextMeasurer(emMeasurer));
  afterEach(() => {
    setTextMeasurer(null);
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  it("mounts the canvas and controls without starting playback", () => {
    const { canvas, clock, q } = mount();
    expect(q(".ksb-view canvas")).toBe(canvas);
    expect(clock.play).not.toHaveBeenCalled();
    expect(q<HTMLButtonElement>(".ksb-big").hidden).toBe(false);
    expect(q(".ksb-time").textContent).toBe("0:00 / 0:30");
    expect(q(".ksb-ch").textContent).toBe("第1章");
    expect(q(".ksb-seek").getAttribute("aria-valuemax")).toBe("30");
    expect(document.querySelectorAll(".ksb-seek .tk")).toHaveLength(2);
  });

  it("injects its stylesheet once", () => {
    mount();
    mount();
    expect(document.querySelectorAll("#ksb-css")).toHaveLength(1);
  });

  it("plays and pauses from the button, swapping the icon and label", async () => {
    const { playback, q } = mount();
    const button = q<HTMLButtonElement>("[data-a=play]");
    button.click();
    await vi.waitFor(() => expect(playback.playing).toBe(true));
    expect(button.getAttribute("aria-label")).toBe("一時停止");
    expect(q<HTMLButtonElement>(".ksb-big").hidden).toBe(true);
    button.click();
    expect(playback.playing).toBe(false);
    expect(button.getAttribute("aria-label")).toBe("再生");
  });

  it("clicking the picture toggles playback", async () => {
    const { playback, q } = mount();
    q<HTMLDivElement>(".ksb-view").click();
    await vi.waitFor(() => expect(playback.playing).toBe(true));
  });

  it("jumps between chapters, restarting the current one first", () => {
    const { playback, stage, player, q } = mount();
    q<HTMLButtonElement>("[data-a=next]").click();
    expect(stage.time).toBeCloseTo(10.01);
    expect(q(".ksb-ch").textContent).toBe("第2章");
    playback.seek(15);
    q<HTMLButtonElement>("[data-a=prev]").click();
    expect(stage.time).toBeCloseTo(10.01);
    q<HTMLButtonElement>("[data-a=prev]").click();
    expect(stage.time).toBeCloseTo(0.01);
    q<HTMLButtonElement>("[data-a=prev]").click();
    expect(stage.time).toBeCloseTo(0.01);
    playback.seek(30);
    player.jump(1);
    expect(stage.time).toBeCloseTo(20.01);
  });

  it("changes speed and toggles captions", () => {
    const { clock, stage, q } = mount();
    const rate = q<HTMLSelectElement>("[data-a=rate]");
    rate.value = "1.5";
    rate.dispatchEvent(new Event("change"));
    expect(clock.playbackRate).toBe(1.5);
    const cc = q<HTMLButtonElement>("[data-a=cc]");
    cc.click();
    expect(stage.captionStyle.enabled).toBe(false);
    expect(cc.getAttribute("aria-pressed")).toBe("false");
  });

  it("seeks with the arrow keys and toggles with space", async () => {
    const { stage, playback, q } = mount();
    const seek = q<HTMLDivElement>(".ksb-seek");
    seek.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(stage.time).toBe(5);
    seek.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(stage.time).toBe(0);
    seek.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(q(".ksb-seek").getAttribute("aria-valuetext")).toBe("0:00");
    seek.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    await vi.waitFor(() => expect(playback.playing).toBe(true));
    q<HTMLButtonElement>("[data-a=cc]").dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(playback.playing).toBe(true);
  });

  it("drags the seek bar, pausing and resuming around it", async () => {
    const { stage, playback, q } = mount();
    const seek = q<HTMLDivElement>(".ksb-seek");
    vi.spyOn(seek, "getBoundingClientRect").mockReturnValue({ left: 0, width: 300 } as DOMRect);
    await playback.play();
    seek.dispatchEvent(Object.assign(new MouseEvent("pointerdown", { clientX: 150 }), { pointerId: 1 }));
    expect(playback.playing).toBe(false);
    expect(stage.time).toBe(15);
    seek.dispatchEvent(new MouseEvent("pointermove", { clientX: 30 }));
    expect(stage.time).toBe(3);
    seek.dispatchEvent(new MouseEvent("pointerup"));
    await vi.waitFor(() => expect(playback.playing).toBe(true));
    seek.dispatchEvent(new MouseEvent("pointermove", { clientX: 300 }));
    expect(stage.time).toBe(3);
  });

  it("asks for fullscreen and leaves it", () => {
    const { q } = mount();
    const view = q<HTMLDivElement>(".ksb-view");
    const request = vi.fn(async () => {});
    Object.assign(view, { requestFullscreen: request });
    q<HTMLButtonElement>("[data-a=full]").click();
    expect(request).toHaveBeenCalledOnce();
    const exit = vi.fn(async () => {});
    Object.defineProperty(document, "fullscreenElement", { value: view, configurable: true });
    Object.assign(document, { exitFullscreen: exit });
    q<HTMLButtonElement>("[data-a=full]").click();
    expect(exit).toHaveBeenCalledOnce();
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
  });

  it("follows its size when ResizeObserver exists", () => {
    let callback: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          callback = cb;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    try {
      const { stage, player, q } = mount();
      vi.spyOn(q<HTMLDivElement>(".ksb-view"), "getBoundingClientRect").mockReturnValue({ width: 480 } as DOMRect);
      callback?.();
      expect(stage.canvas.width).toBe(480);
      expect(stage.canvas.height).toBe(270);
      player.destroy();
      expect(disconnect).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("destroy removes the DOM and stops listening", () => {
    const { player, host, stage } = mount();
    player.destroy();
    expect(host.children).toHaveLength(0);
    stage.update(5);
    expect(player.el.querySelector(".ksb-time")?.textContent).toBe("0:00 / 0:30");
  });
});

describe("formatClock", () => {
  it("prints m:ss and clamps negatives", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(185.9)).toBe("3:05");
    expect(formatClock(-4)).toBe("0:00");
  });
});
