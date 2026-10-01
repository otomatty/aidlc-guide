import { DOC_VIDEO_TEMPLATES, type DocVideoTemplate } from "@aidlc-guide/shared-types";
import type { Scene } from "../scene.ts";
import { Circle, Fonts, Line, Rect, Text } from "../shapes.ts";

/**
 * Scene templates. A template owns every coordinate: a storyboard only
 * supplies words, so an LLM-written storyboard can never break the layout,
 * and long words are absorbed by `Text.fit`.
 */

export interface VideoTheme {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  /** Text drawn on an accent fill. */
  onAccent: string;
  line: string;
  displayFont: string;
  bodyFont: string;
}

export const DEFAULT_THEME: VideoTheme = {
  background: "#0b1d23",
  surface: "#13303a",
  text: "#eef1ea",
  muted: "#9fb3b8",
  accent: "#f2c230",
  onAccent: "#0b1d23",
  line: "#2c5361",
  displayFont: Fonts.display,
  bodyFont: Fonts.body,
};

export interface TemplateContext {
  scene: Scene;
  data: Record<string, unknown>;
  theme: VideoTheme;
  width: number;
  height: number;
  /** 1-based chapter number, for the header badge. */
  chapterNo: number;
  chapterTitle: string;
  cueCount: number;
  /** Scene-time start of caption `i`, clamped into the chapter's captions. */
  cueAt(i: number): number;
}

type TemplateBuild = (ctx: TemplateContext) => void;

/** Raised for template data that does not fit the template; becomes a load error. */
export class TemplateDataError extends Error {}

function text(data: Record<string, unknown>, key: string, template: string): string {
  const value = data[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new TemplateDataError(`${template}: ${key} must be non-empty text`);
  }
  return value;
}

function optionalText(data: Record<string, unknown>, key: string, template: string): string | null {
  return data[key] === undefined ? null : text(data, key, template);
}

/** `at`: the caption index an element enters on. Absent means "use the default". */
function optionalAt(item: Record<string, unknown>, template: string): number | null {
  const at = item.at;
  if (at === undefined) return null;
  if (typeof at !== "number" || !Number.isInteger(at) || at < 0) {
    throw new TemplateDataError(`${template}: at must be a caption index`);
  }
  return at;
}

function items(
  data: Record<string, unknown>,
  key: string,
  template: string,
  min: number,
  max: number,
): Record<string, unknown>[] {
  const value = data[key];
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new TemplateDataError(`${template}: ${key} needs ${min}–${max} entries`);
  }
  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new TemplateDataError(`${template}: ${key} entries must be objects`);
    }
    return entry as Record<string, unknown>;
  });
}

const MARGIN_X = 160;
const CONTENT_W = 1600;

/** Chapter badge and title along the top, shared by the content templates. */
function header(ctx: TemplateContext): void {
  const { scene, theme } = ctx;
  const badge = scene.add(
    new Rect({
      x: MARGIN_X,
      y: 84,
      w: 76,
      h: 56,
      radius: 12,
      fill: theme.accent,
      anchorX: 0,
      anchorY: 0,
    }),
  );
  badge.add(
    new Text({
      text: String(ctx.chapterNo).padStart(2, "0"),
      x: 38,
      y: 28,
      size: 32,
      weight: 700,
      align: "center",
      anchorY: 0.5,
      color: theme.onAccent,
      family: theme.displayFont,
    }),
  );
  badge.fadeIn(0, 0.5, { dx: -20 });
  scene
    .add(
      new Text({
        text: ctx.chapterTitle,
        x: MARGIN_X + 100,
        y: 112,
        size: 52,
        weight: 700,
        anchorY: 0.5,
        maxWidth: CONTENT_W - 100,
        fit: { maxLines: 1, minSize: 36 },
        color: theme.text,
        family: theme.displayFont,
      }),
    )
    .fadeIn(0.1, 0.5, { dx: -20 });
}

const title: TemplateBuild = (ctx) => {
  const { scene, theme, data, width } = ctx;
  const eyebrow = optionalText(data, "eyebrow", "title");
  const headline = text(data, "headline", "title");
  const subtitle = optionalText(data, "subtitle", "title");
  const at = ctx.cueAt(0);
  if (eyebrow !== null) {
    scene
      .add(
        new Text({
          text: eyebrow,
          x: width / 2,
          y: 330,
          size: 36,
          weight: 700,
          align: "center",
          color: theme.accent,
          family: theme.bodyFont,
        }),
      )
      .fadeIn(at, 0.6, { dy: 20 });
  }
  scene
    .add(
      new Text({
        text: headline,
        x: width / 2,
        y: 400,
        size: 96,
        weight: 800,
        align: "center",
        maxWidth: CONTENT_W,
        lineHeight: 1.25,
        fit: { maxLines: 2, minSize: 60 },
        color: theme.text,
        emColor: theme.accent,
        family: theme.displayFont,
      }),
    )
    .fadeIn(at + 0.2, 0.8, { dy: 30 });
  scene
    .add(
      new Line({
        points: [width / 2 - 120, 660, width / 2 + 120, 660],
        color: theme.accent,
        width: 6,
        trimEnd: 0,
      }),
    )
    .to({ trimEnd: 1 }, { at: at + 0.6, dur: 0.8 });
  if (subtitle !== null) {
    scene
      .add(
        new Text({
          text: subtitle,
          x: width / 2,
          y: 700,
          size: 44,
          align: "center",
          maxWidth: CONTENT_W,
          fit: { maxLines: 2, minSize: 32 },
          color: theme.muted,
          family: theme.bodyFont,
        }),
      )
      .fadeIn(at + 0.9, 0.6);
  }
};

const POINT_H = 112;
const POINT_GAP = 22;

const points: TemplateBuild = (ctx) => {
  const { scene, theme, data } = ctx;
  header(ctx);
  const heading = optionalText(data, "heading", "points");
  const list = items(data, "items", "points", 1, 5);
  let top = 210;
  if (heading !== null) {
    scene
      .add(
        new Text({
          text: heading,
          x: MARGIN_X,
          y: top,
          size: 44,
          weight: 700,
          maxWidth: CONTENT_W,
          fit: { maxLines: 1, minSize: 32 },
          color: theme.muted,
          family: theme.bodyFont,
        }),
      )
      .fadeIn(ctx.cueAt(0), 0.5);
    top += 90;
  } else {
    top += 40;
  }
  list.forEach((item, i) => {
    const label = text(item, "text", "points");
    const at = ctx.cueAt(optionalAt(item, "points") ?? i);
    const card = scene.add(
      new Rect({
        x: MARGIN_X,
        y: top + i * (POINT_H + POINT_GAP),
        w: CONTENT_W,
        h: POINT_H,
        radius: 18,
        fill: theme.surface,
        anchorX: 0,
        anchorY: 0,
      }),
    );
    card.add(new Circle({ x: 56, y: POINT_H / 2, r: 14, fill: theme.accent }));
    card.add(
      new Text({
        text: label,
        x: 100,
        y: POINT_H / 2,
        size: 42,
        anchorY: 0.5,
        maxWidth: CONTENT_W - 140,
        lineHeight: 1.3,
        fit: { maxLines: 2, minSize: 28 },
        color: theme.text,
        emColor: theme.accent,
        family: theme.bodyFont,
      }),
    );
    card.fadeIn(at, 0.6, { dx: -40 });
  });
};

const FLOW_PER_ROW = 4;
const FLOW_H = 190;
const FLOW_GAP = 64;

const flow: TemplateBuild = (ctx) => {
  const { scene, theme, data } = ctx;
  header(ctx);
  const heading = optionalText(data, "heading", "flow");
  const steps = items(data, "steps", "flow", 2, 8);
  if (heading !== null) {
    scene
      .add(
        new Text({
          text: heading,
          x: MARGIN_X,
          y: 210,
          size: 44,
          weight: 700,
          maxWidth: CONTENT_W,
          fit: { maxLines: 1, minSize: 32 },
          color: theme.muted,
          family: theme.bodyFont,
        }),
      )
      .fadeIn(ctx.cueAt(0), 0.5);
  }
  const rows = Math.ceil(steps.length / FLOW_PER_ROW);
  const perRow = Math.ceil(steps.length / rows);
  const boxW = (CONTENT_W - FLOW_GAP * (perRow - 1)) / perRow;
  const rowTop = (row: number) => (rows === 1 ? 430 : 340 + row * (FLOW_H + 130));
  const boxAt = (i: number) => {
    const row = Math.floor(i / perRow);
    return { x: MARGIN_X + (i % perRow) * (boxW + FLOW_GAP), y: rowTop(row), row };
  };
  steps.forEach((step, i) => {
    const label = text(step, "label", "flow");
    const sub = optionalText(step, "sub", "flow");
    // By default steps enter spread evenly over the chapter's captions.
    const at = ctx.cueAt(optionalAt(step, "flow") ?? Math.floor((i * ctx.cueCount) / steps.length));
    const { x, y, row } = boxAt(i);
    const box = scene.add(
      new Rect({
        x,
        y,
        w: boxW,
        h: FLOW_H,
        radius: 20,
        fill: theme.surface,
        stroke: theme.line,
        lineWidth: 2,
        anchorX: 0,
        anchorY: 0,
      }),
    );
    box.add(
      new Text({
        text: label,
        x: boxW / 2,
        y: sub === null ? FLOW_H / 2 : FLOW_H / 2 - 26,
        size: 40,
        weight: 700,
        align: "center",
        anchorY: 0.5,
        maxWidth: boxW - 40,
        fit: { maxLines: 1, minSize: 24 },
        color: theme.text,
        family: theme.displayFont,
      }),
    );
    if (sub !== null) {
      box.add(
        new Text({
          text: sub,
          x: boxW / 2,
          y: FLOW_H / 2 + 30,
          size: 28,
          align: "center",
          anchorY: 0.5,
          maxWidth: boxW - 40,
          fit: { maxLines: 2, minSize: 20 },
          color: theme.muted,
          family: theme.bodyFont,
        }),
      );
    }
    box.fadeIn(at, 0.6, { dy: 30 });
    if (i > 0) {
      const prev = boxAt(i - 1);
      const points =
        prev.row === row
          ? [prev.x + boxW + 8, y + FLOW_H / 2, x - 8, y + FLOW_H / 2]
          : [
              prev.x + boxW / 2,
              prev.y + FLOW_H + 8,
              prev.x + boxW / 2,
              prev.y + FLOW_H + 65,
              x + boxW / 2,
              prev.y + FLOW_H + 65,
              x + boxW / 2,
              y - 8,
            ];
      scene
        .add(new Line({ points, color: theme.accent, width: 5, arrow: 18, trimEnd: 0 }))
        .to({ trimEnd: 1 }, { at: Math.max(0, at - 0.3), dur: 0.5 });
    }
  });
};

const TEMPLATES: Record<DocVideoTemplate, TemplateBuild> = { title, points, flow };

/** Every template name this renderer knows, in contract order. */
export const TEMPLATE_NAMES: readonly string[] = DOC_VIDEO_TEMPLATES;

export function templateFor(name: string): TemplateBuild | null {
  return Object.hasOwn(TEMPLATES, name) ? TEMPLATES[name as DocVideoTemplate] : null;
}
