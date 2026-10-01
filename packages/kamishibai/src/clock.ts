/**
 * Where playback time comes from. The narration audio is the master clock in
 * production (`AudioClock`): the picture reads `currentTime` every frame, so
 * it can never drift from the sound however long the video runs.
 */
export interface Clock {
  readonly currentTime: number;
  readonly paused: boolean;
  /** The source ran out on its own (audio reached its end). */
  readonly ended: boolean;
  playbackRate: number;
  /** May reject, e.g. when the host blocks audio until a user gesture. */
  play(): Promise<void>;
  pause(): void;
  seek(t: number): void;
}

/** A wall-clock timer, for silent previews and drafts with no narration yet. */
export class TimerClock implements Clock {
  private base = 0;
  private startedAt: number | null = null;
  private rate = 1;
  private readonly now: () => number;

  constructor(now: () => number = () => performance.now()) {
    this.now = now;
  }

  get currentTime(): number {
    return this.startedAt === null
      ? this.base
      : this.base + ((this.now() - this.startedAt) / 1000) * this.rate;
  }

  get paused(): boolean {
    return this.startedAt === null;
  }

  get ended(): boolean {
    return false;
  }

  get playbackRate(): number {
    return this.rate;
  }

  set playbackRate(rate: number) {
    this.rebase();
    this.rate = rate;
  }

  play(): Promise<void> {
    this.startedAt ??= this.now();
    return Promise.resolve();
  }

  pause(): void {
    this.base = this.currentTime;
    this.startedAt = null;
  }

  seek(t: number): void {
    this.base = t;
    if (this.startedAt !== null) this.startedAt = this.now();
  }

  /** Fold elapsed time into `base` so a rate change applies from now on only. */
  private rebase(): void {
    if (this.startedAt === null) return;
    this.base = this.currentTime;
    this.startedAt = this.now();
  }
}

/** The narration `<audio>` element as the clock. Rate changes keep the voice's pitch. */
export class AudioClock implements Clock {
  private readonly audio: HTMLMediaElement;

  constructor(audio: HTMLMediaElement) {
    this.audio = audio;
    audio.preservesPitch = true;
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }

  get paused(): boolean {
    return this.audio.paused;
  }

  get ended(): boolean {
    return this.audio.ended;
  }

  get playbackRate(): number {
    return this.audio.playbackRate;
  }

  set playbackRate(rate: number) {
    this.audio.preservesPitch = true;
    this.audio.playbackRate = rate;
  }

  play(): Promise<void> {
    return this.audio.play();
  }

  pause(): void {
    this.audio.pause();
  }

  seek(t: number): void {
    this.audio.currentTime = t;
  }
}
