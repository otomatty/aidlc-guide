import type { Clock } from "./clock.ts";
import { clamp } from "./ease.ts";
import { Emitter } from "./emitter.ts";
import type { Stage } from "./stage.ts";

/** requestAnimationFrame, injectable for tests and non-DOM hosts. */
export interface FrameScheduler {
  request(cb: () => void): number;
  cancel(id: number): void;
}

const defaultScheduler: FrameScheduler =
  typeof requestAnimationFrame === "function"
    ? {
        request: (cb) => requestAnimationFrame(cb),
        cancel: (id) => cancelAnimationFrame(id),
      }
    : {
        request: (cb) => setTimeout(cb, 16) as unknown as number,
        cancel: (id) => clearTimeout(id),
      };

type PlaybackEvents = {
  play: [];
  pause: [];
  seek: [number];
  end: [];
  /** `clock.play()` was refused (e.g. audio before any user gesture). */
  error: [unknown];
};

/** Couples a stage to a clock: every frame the stage is drawn at the clock's time. */
export class Playback extends Emitter<PlaybackEvents> {
  readonly stage: Stage;
  readonly clock: Clock;
  private readonly scheduler: FrameScheduler;
  private frame: number | null = null;
  private active = false;

  constructor(stage: Stage, clock: Clock, scheduler: FrameScheduler = defaultScheduler) {
    super();
    this.stage = stage;
    this.clock = clock;
    this.scheduler = scheduler;
  }

  get playing(): boolean {
    return this.active;
  }

  get time(): number {
    return this.stage.time;
  }

  get rate(): number {
    return this.clock.playbackRate;
  }

  set rate(rate: number) {
    this.clock.playbackRate = rate;
  }

  async play(): Promise<void> {
    if (this.active) return;
    if (this.stage.time >= this.stage.duration) this.seek(0);
    this.active = true;
    try {
      await this.clock.play();
    } catch (cause) {
      // Paused while the clock was starting: the media element aborts play().
      // That is the user's pause, not a playback failure.
      if (!this.active) return;
      this.active = false;
      this.emit("error", cause);
      return;
    }
    if (!this.active) {
      // Paused while the clock was starting.
      this.clock.pause();
      return;
    }
    this.frame = this.scheduler.request(this.tick);
    this.emit("play");
  }

  pause(): void {
    if (!this.active) return;
    this.active = false;
    this.clock.pause();
    this.cancelFrame();
    this.stage.update(this.clock.currentTime);
    this.emit("pause");
  }

  toggle(): void {
    if (this.active) this.pause();
    else void this.play();
  }

  seek(t: number): void {
    const time = clamp(t, 0, this.stage.duration);
    this.clock.seek(time);
    this.stage.seek(time);
    this.emit("seek", this.stage.time);
  }

  /** Stop scheduling frames; the caller owns the clock and stage. */
  dispose(): void {
    this.active = false;
    this.cancelFrame();
  }

  private readonly tick = (): void => {
    this.frame = null;
    if (!this.active) return;
    const t = this.clock.currentTime;
    if (t >= this.stage.duration || this.clock.ended) {
      this.active = false;
      this.clock.pause();
      this.stage.seek(this.stage.duration);
      this.emit("pause");
      this.emit("end");
      return;
    }
    this.stage.update(t);
    this.frame = this.scheduler.request(this.tick);
  };

  private cancelFrame(): void {
    if (this.frame !== null) this.scheduler.cancel(this.frame);
    this.frame = null;
  }
}
