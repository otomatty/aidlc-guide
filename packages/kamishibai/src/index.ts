/**
 * Kamishibai — a timeline animation engine for narrated explainer videos.
 *
 *  - Rendering is a pure function of time t: any moment can be drawn in any
 *    order, so seeking and frame-by-frame export are exact.
 *  - Properties animate by stacking time-stamped tweens (`to` / `from` / `set`).
 *  - Captions come first and animations are timed to them ("script-driven").
 *  - Playback follows the narration audio (`AudioClock`), never the reverse.
 *  - No dependencies: Canvas 2D only.
 */
export { AudioClock, type Clock, TimerClock } from "./clock.ts";
export { parseColor, withAlpha } from "./color.ts";
export { Ease, type EaseFn, type EaseName } from "./ease.ts";
export type { BaseProps, Ctx2D, LifeOptions, MotionOptions, TweenOptions } from "./node.ts";
export { Node } from "./node.ts";
export { type FrameScheduler, Playback } from "./playback.ts";
export { formatClock, Player } from "./player.ts";
export { Scene, type SceneCue, type SceneOptions } from "./scene.ts";
export {
  Circle,
  type CircleProps,
  Counter,
  type CounterProps,
  Fonts,
  Group,
  ImageNode,
  type ImageProps,
  Line,
  type LineProps,
  Rect,
  type RectProps,
  roundRectPath,
  Shape,
  type ShapeDraw,
  Text,
  type TextFit,
  type TextProps,
} from "./shapes.ts";
export {
  type CanvasLike,
  type CaptionStyle,
  type Chapter,
  Stage,
  type StageCue,
  type StageOptions,
} from "./stage.ts";
export { setTextMeasurer, type TextMeasurer } from "./text-layout.ts";
export { random, stagger } from "./util.ts";
export { toVTT } from "./vtt.ts";

export const version = "1.0.0";
