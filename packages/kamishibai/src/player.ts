import { clamp } from "./ease.ts";
import type { Playback } from "./playback.ts";

/**
 * The controls take the VS Code theme where one exists (webview), and fall
 * back to the original dark palette in a plain page (CLI preview).
 */
const PLAYER_CSS = `
.ksb{--ksb-accent:var(--vscode-focusBorder,#f2c230);--ksb-fg:var(--vscode-foreground,#eef1ea);
  --ksb-bar:var(--vscode-editorWidget-background,#0b1d23);--ksb-track:rgba(128,128,128,.35);
  display:flex;flex-direction:column;background:var(--ksb-bar);border-radius:10px;overflow:hidden;color:var(--ksb-fg);
  font:500 13px/1.2 system-ui,sans-serif;user-select:none}
.ksb-view{position:relative;aspect-ratio:16/9;width:100%;max-width:100%;background:#000;cursor:pointer}
.ksb-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.ksb-big{position:absolute;inset:0;margin:auto;width:84px;height:84px;border-radius:50%;border:0;
  background:rgba(0,0,0,.55);color:#fff;display:grid;place-items:center;cursor:pointer}
.ksb-big[hidden]{display:none}
.ksb-big svg{width:34px;height:34px;margin-left:5px}
.ksb-seek{position:relative;height:18px;margin:0 12px;cursor:pointer;touch-action:none}
.ksb-seek .tr{position:absolute;left:0;right:0;top:7px;height:4px;border-radius:2px;background:var(--ksb-track)}
.ksb-seek .fi{position:absolute;left:0;top:7px;height:4px;border-radius:2px;background:var(--ksb-accent)}
.ksb-seek .kn{position:absolute;top:3px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:var(--ksb-accent)}
.ksb-seek .tk{position:absolute;top:5px;width:2px;height:8px;background:var(--ksb-bar)}
.ksb-seek:focus-visible{outline:2px solid var(--ksb-accent);outline-offset:2px}
.ksb-row{display:flex;align-items:center;gap:6px;padding:4px 8px 8px;flex-wrap:wrap}
.ksb-row button,.ksb-row select{background:transparent;color:inherit;border:1px solid transparent;border-radius:6px;
  height:32px;min-width:32px;padding:0 8px;font:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.ksb-row select{border-color:var(--ksb-track)}
.ksb-row select option{color:#000}
.ksb-row button:hover{background:rgba(128,128,128,.15)}
.ksb-row button:focus-visible,.ksb-row select:focus-visible{outline:2px solid var(--ksb-accent)}
.ksb-row button[aria-pressed=true]{border-color:var(--ksb-accent);color:var(--ksb-accent)}
.ksb-row svg{width:18px;height:18px}
.ksb-time{font-variant-numeric:tabular-nums;opacity:.85;padding:0 4px}
.ksb-ch{flex:1;min-width:120px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:560px){.ksb-ch{display:none}.ksb-row .ksb-lbl{display:none}}`;

const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
  pause:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 6 5 12l6 6M19 6l-6 6 6 6"/></svg>',
  fwd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m13 6 6 6-6 6M5 6l6 6-6 6"/></svg>',
  cc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
};

const RATES = [0.75, 1, 1.25, 1.5, 2];
/** Arrow-key seek step, seconds. */
const SEEK_STEP = 5;
/** "Previous chapter" restarts the current one when more than this far into it. */
const RESTART_THRESHOLD = 1.5;

/** `m:ss`. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (el === null) throw new Error(`Kamishibai player: missing ${selector}`);
  return el;
}

/**
 * Player controls: play/pause, chapter skip, seek bar with chapter ticks,
 * speed, captions on/off, fullscreen. It never starts playing on its own —
 * audio needs a user gesture, and a docs page must not talk unprompted.
 */
export class Player {
  readonly el: HTMLDivElement;
  private readonly playback: Playback;
  private readonly view: HTMLDivElement;
  private readonly big: HTMLButtonElement;
  private readonly seekEl: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly timeEl: HTMLSpanElement;
  private readonly chapterEl: HTMLSpanElement;
  private readonly playButton: HTMLButtonElement;
  private readonly cleanups: (() => void)[] = [];

  constructor(playback: Playback, mount: HTMLElement) {
    this.playback = playback;
    const doc = mount.ownerDocument;
    if (doc.getElementById("ksb-css") === null) {
      const style = doc.createElement("style");
      style.id = "ksb-css";
      style.textContent = PLAYER_CSS;
      doc.head.append(style);
    }
    const el = doc.createElement("div");
    el.className = "ksb";
    // Static markup only: no caller-supplied text is ever interpolated here.
    el.innerHTML = `
      <div class="ksb-view"><button type="button" class="ksb-big" aria-label="再生">${ICON.play}</button></div>
      <div class="ksb-seek" role="slider" tabindex="0" aria-label="再生位置" aria-valuemin="0"><div class="tr"></div><div class="fi"></div><div class="kn"></div></div>
      <div class="ksb-row">
        <button type="button" data-a="play" aria-label="再生">${ICON.play}</button>
        <button type="button" data-a="prev" aria-label="前の章">${ICON.back}</button>
        <button type="button" data-a="next" aria-label="次の章">${ICON.fwd}</button>
        <span class="ksb-time">0:00 / 0:00</span>
        <span class="ksb-ch"></span>
        <select data-a="rate" aria-label="再生速度">${RATES.map((r) => `<option value="${r}"${r === 1 ? " selected" : ""}>${r}x</option>`).join("")}</select>
        <button type="button" data-a="cc" aria-pressed="true" aria-label="字幕">${ICON.cc}<span class="ksb-lbl">字幕</span></button>
        <button type="button" data-a="full" aria-label="全画面">${ICON.full}</button>
      </div>`;
    mount.append(el);
    this.el = el;
    this.view = required(el, ".ksb-view");
    this.big = required(el, ".ksb-big");
    this.seekEl = required(el, ".ksb-seek");
    this.fill = required(this.seekEl, ".fi");
    this.knob = required(this.seekEl, ".kn");
    this.timeEl = required(el, ".ksb-time");
    this.chapterEl = required(el, ".ksb-ch");
    this.playButton = required(el, "[data-a=play]");

    const stage = playback.stage;
    if (stage.canvas instanceof HTMLCanvasElement) this.view.prepend(stage.canvas);
    this.seekEl.setAttribute("aria-valuemax", String(Math.round(stage.duration)));
    for (const chapter of stage.chapters.slice(1)) {
      const tick = doc.createElement("div");
      tick.className = "tk";
      tick.style.left = `${(chapter.start / stage.duration) * 100}%`;
      this.seekEl.append(tick);
    }

    this.watchSize();
    this.listen(this.view, "click", () => playback.toggle());
    this.listen(this.playButton, "click", () => playback.toggle());
    this.listen(required(el, "[data-a=prev]"), "click", () => this.jump(-1));
    this.listen(required(el, "[data-a=next]"), "click", () => this.jump(1));
    const rate = required<HTMLSelectElement>(el, "[data-a=rate]");
    this.listen(rate, "change", () => {
      playback.rate = Number(rate.value);
    });
    const cc = required<HTMLButtonElement>(el, "[data-a=cc]");
    this.listen(cc, "click", () => this.toggleCaptions(cc));
    this.listen(required(el, "[data-a=full]"), "click", () => this.toggleFullscreen());
    this.bindSeekBar();
    this.listen(el, "keydown", (e) => {
      const target = e.target as Element | null;
      if (e.key === " " && target?.tagName !== "SELECT" && target?.tagName !== "BUTTON") {
        playback.toggle();
        e.preventDefault();
      }
    });

    const update = () => this.update();
    this.cleanups.push(
      stage.on("time", update),
      playback.on("seek", update),
      playback.on("play", update),
      playback.on("pause", update),
    );
    this.update();
  }

  /** Go to the previous (-1) / next (+1) chapter. */
  jump(direction: -1 | 1): void {
    const { stage } = this.playback;
    const chapters = stage.chapters;
    if (chapters.length === 0) return;
    let index = chapters.findIndex((c) => stage.time < c.start + c.duration);
    if (index === -1) index = chapters.length - 1;
    const current = chapters[index];
    let step: number = direction;
    if (direction < 0 && current !== undefined && stage.time - current.start > RESTART_THRESHOLD)
      step = 0;
    const target = chapters[clamp(index + step, 0, chapters.length - 1)];
    if (target !== undefined) this.playback.seek(target.start + 0.01);
  }

  update(): void {
    const { stage } = this.playback;
    const playing = this.playback.playing;
    const progress = stage.duration ? stage.time / stage.duration : 0;
    this.fill.style.width = `${progress * 100}%`;
    this.knob.style.left = `${progress * 100}%`;
    this.seekEl.setAttribute("aria-valuenow", String(Math.round(stage.time)));
    this.seekEl.setAttribute("aria-valuetext", formatClock(stage.time));
    this.timeEl.textContent = `${formatClock(stage.time)} / ${formatClock(stage.duration)}`;
    this.chapterEl.textContent = stage.sceneAt(stage.time)?.title ?? "";
    if (this.playButton.dataset.state !== String(playing)) {
      this.playButton.innerHTML = playing ? ICON.pause : ICON.play;
      this.playButton.dataset.state = String(playing);
      this.playButton.setAttribute("aria-label", playing ? "一時停止" : "再生");
    }
    this.big.hidden = playing;
  }

  /** Remove listeners and the DOM. The playback itself is the caller's to dispose. */
  destroy(): void {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.el.remove();
  }

  private listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
  ): void {
    target.addEventListener(type, fn);
    this.cleanups.push(() => target.removeEventListener(type, fn));
  }

  private toggleCaptions(button: HTMLButtonElement): void {
    const { stage } = this.playback;
    stage.captionStyle.enabled = !stage.captionStyle.enabled;
    button.setAttribute("aria-pressed", String(stage.captionStyle.enabled));
    stage.renderAt(stage.time);
  }

  private toggleFullscreen(): void {
    const doc = this.view.ownerDocument;
    if (doc.fullscreenElement) void doc.exitFullscreen();
    else if (typeof this.view.requestFullscreen === "function") {
      this.view.requestFullscreen().catch(() => {});
    }
  }

  /** Match the canvas resolution to its displayed size (capped at the logical size). */
  private watchSize(): void {
    if (typeof ResizeObserver === "undefined") return;
    const { stage } = this.playback;
    const observer = new ResizeObserver(() => {
      const rect = this.view.getBoundingClientRect();
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
      const w = Math.min(stage.width, Math.max(320, rect.width * dpr));
      stage.setPixelSize(w, (w * stage.height) / stage.width);
    });
    observer.observe(this.view);
    this.cleanups.push(() => observer.disconnect());
  }

  private bindSeekBar(): void {
    const { stage } = this.playback;
    const seekTo = (clientX: number) => {
      const rect = this.seekEl.getBoundingClientRect();
      const fraction = rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
      this.playback.seek(fraction * stage.duration);
    };
    this.listen(this.seekEl, "pointerdown", (e) => {
      this.seekEl.setPointerCapture?.(e.pointerId);
      const wasPlaying = this.playback.playing;
      this.playback.pause();
      seekTo(e.clientX);
      const move = (ev: PointerEvent) => seekTo(ev.clientX);
      const up = () => {
        this.seekEl.removeEventListener("pointermove", move);
        this.seekEl.removeEventListener("pointerup", up);
        if (wasPlaying) void this.playback.play();
      };
      this.seekEl.addEventListener("pointermove", move);
      this.seekEl.addEventListener("pointerup", up);
    });
    this.listen(this.seekEl, "keydown", (e) => {
      if (e.key === "ArrowRight") {
        this.playback.seek(stage.time + SEEK_STEP);
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        this.playback.seek(stage.time - SEEK_STEP);
        e.preventDefault();
      }
    });
  }
}
