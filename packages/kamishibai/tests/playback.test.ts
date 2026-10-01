import { describe, expect, it, vi } from "vitest";
import { AudioClock, type Clock, TimerClock } from "../src/clock.ts";
import { type FrameScheduler, Playback } from "../src/playback.ts";
import { Stage } from "../src/stage.ts";
import { fakeCanvas } from "./fake-canvas.ts";

/** A frame scheduler the test steps by hand. */
function manualFrames() {
  let next = 1;
  const pending = new Map<number, () => void>();
  const scheduler: FrameScheduler = {
    request: (cb) => {
      const id = next++;
      pending.set(id, cb);
      return id;
    },
    cancel: (id) => {
      pending.delete(id);
    },
  };
  const step = () => {
    const callbacks = [...pending.values()];
    pending.clear();
    for (const cb of callbacks) cb();
  };
  return { scheduler, step, pending };
}

/** A clock whose time the test sets directly. */
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

function setup() {
  const stage = new Stage(fakeCanvas());
  stage.scene("a", { duration: 10 }).caption("字幕", 1, 2);
  const clock = new ManualClock();
  const frames = manualFrames();
  const playback = new Playback(stage, clock, frames.scheduler);
  return { stage, clock, frames, playback };
}

describe("TimerClock", () => {
  it("advances only while playing, at the playback rate", async () => {
    let now = 1000;
    const clock = new TimerClock(() => now);
    expect(clock.paused).toBe(true);
    expect(clock.ended).toBe(false);
    await clock.play();
    now += 2000;
    expect(clock.currentTime).toBe(2);
    clock.playbackRate = 2;
    expect(clock.playbackRate).toBe(2);
    now += 1000;
    expect(clock.currentTime).toBe(4);
    clock.pause();
    now += 5000;
    expect(clock.currentTime).toBe(4);
    clock.seek(1);
    expect(clock.currentTime).toBe(1);
    clock.playbackRate = 1;
    await clock.play();
    clock.seek(3);
    now += 500;
    expect(clock.currentTime).toBe(3.5);
  });

  it("defaults to performance.now", () => {
    expect(new TimerClock().currentTime).toBe(0);
  });
});

describe("AudioClock", () => {
  it("reads and drives the media element, keeping pitch", async () => {
    const audio = {
      currentTime: 0,
      paused: true,
      ended: false,
      playbackRate: 1,
      preservesPitch: false,
      play: vi.fn(async () => {}),
      pause: vi.fn(),
    };
    const clock = new AudioClock(audio as unknown as HTMLMediaElement);
    expect(audio.preservesPitch).toBe(true);
    audio.preservesPitch = false;
    clock.playbackRate = 1.5;
    expect(audio.playbackRate).toBe(1.5);
    expect(clock.playbackRate).toBe(1.5);
    expect(audio.preservesPitch).toBe(true);
    clock.seek(12);
    expect(clock.currentTime).toBe(12);
    await clock.play();
    clock.pause();
    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(clock.paused).toBe(true);
    expect(clock.ended).toBe(false);
  });
});

describe("Playback", () => {
  it("draws the stage at the clock's time on every frame", async () => {
    const { stage, clock, frames, playback } = setup();
    const onPlay = vi.fn();
    playback.on("play", onPlay);
    await playback.play();
    expect(playback.playing).toBe(true);
    expect(onPlay).toHaveBeenCalledOnce();
    clock.currentTime = 1.5;
    frames.step();
    expect(stage.time).toBe(1.5);
    expect(playback.time).toBe(1.5);
    clock.currentTime = 2.25;
    frames.step();
    expect(stage.time).toBe(2.25);
  });

  it("does nothing when play is called twice", async () => {
    const { clock, playback } = setup();
    await playback.play();
    await playback.play();
    expect(clock.play).toHaveBeenCalledOnce();
  });

  it("pauses: stops frames and settles the stage on the clock", async () => {
    const { stage, clock, frames, playback } = setup();
    await playback.play();
    clock.currentTime = 4;
    const onPause = vi.fn();
    playback.on("pause", onPause);
    playback.pause();
    playback.pause();
    expect(onPause).toHaveBeenCalledOnce();
    expect(stage.time).toBe(4);
    expect(frames.pending.size).toBe(0);
    expect(clock.pause).toHaveBeenCalledOnce();
  });

  it("toggles between play and pause", async () => {
    const { playback } = setup();
    playback.toggle();
    await Promise.resolve();
    expect(playback.playing).toBe(true);
    playback.toggle();
    expect(playback.playing).toBe(false);
  });

  it("ends at the stage's end or when the audio runs out", async () => {
    const { stage, clock, frames, playback } = setup();
    const onEnd = vi.fn();
    playback.on("end", onEnd);
    await playback.play();
    clock.currentTime = 10.2;
    frames.step();
    expect(onEnd).toHaveBeenCalledOnce();
    expect(playback.playing).toBe(false);
    expect(stage.time).toBe(10);

    // Playing again from the end restarts from 0.
    await playback.play();
    expect(clock.seek).toHaveBeenLastCalledWith(0);
    clock.currentTime = 3;
    clock.ended = true;
    frames.step();
    expect(onEnd).toHaveBeenCalledTimes(2);
  });

  it("seeks clock and stage together, clamped", () => {
    const { stage, clock, playback } = setup();
    const seeks: number[] = [];
    playback.on("seek", (t) => seeks.push(t));
    playback.seek(-3);
    playback.seek(4);
    playback.seek(99);
    expect(seeks).toEqual([0, 4, 10]);
    expect(clock.currentTime).toBe(10);
    expect(stage.time).toBe(10);
  });

  it("reports a refused start and stays stopped", async () => {
    const { clock, frames, playback } = setup();
    const blocked = new Error("NotAllowedError");
    clock.play.mockRejectedValueOnce(blocked);
    const onError = vi.fn();
    playback.on("error", onError);
    await playback.play();
    expect(onError).toHaveBeenCalledWith(blocked);
    expect(playback.playing).toBe(false);
    expect(frames.pending.size).toBe(0);
  });

  it("honours a pause that lands while the clock is starting", async () => {
    const { clock, frames, playback } = setup();
    const starting = playback.play();
    playback.pause();
    await starting;
    expect(playback.playing).toBe(false);
    expect(frames.pending.size).toBe(0);
    expect(clock.pause).toHaveBeenCalledTimes(2);
  });

  it("passes the rate through to the clock", () => {
    const { clock, playback } = setup();
    playback.rate = 1.25;
    expect(clock.playbackRate).toBe(1.25);
    expect(playback.rate).toBe(1.25);
  });

  it("dispose stops scheduling and a stale frame is ignored", async () => {
    const { stage, clock, frames, playback } = setup();
    await playback.play();
    const callbacks = [...frames.pending.values()];
    playback.dispose();
    expect(frames.pending.size).toBe(0);
    clock.currentTime = 5;
    for (const cb of callbacks) cb();
    expect(stage.time).toBe(0);
  });

  it("falls back to timers when requestAnimationFrame is missing", async () => {
    vi.useFakeTimers();
    try {
      const stage = new Stage(fakeCanvas());
      stage.scene("a", { duration: 10 });
      const clock = new ManualClock();
      const playback = new Playback(stage, clock);
      await playback.play();
      clock.currentTime = 2;
      vi.advanceTimersByTime(20);
      expect(stage.time).toBe(2);
      playback.pause();
    } finally {
      vi.useRealTimers();
    }
  });
});
