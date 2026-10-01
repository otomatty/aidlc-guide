/** Width in pixels of `text` drawn with the CSS `font` shorthand. */
export type TextMeasurer = (font: string, text: string) => number;

/** Characters that may not start a line (行頭禁則). They hang off the previous line instead. */
const NO_LINE_START = new Set(
  "、。，．,.・：:；;？?！!ー－―…‥」』）)］]｝}〉》〕】ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ%％",
);

/** Runs of Latin letters, digits and URL-ish punctuation wrap as one word. */
const TOKEN_RE = /[A-Za-z0-9#@&_\-/.+'’%〜～]+|\n|./gsu;

interface Token {
  s: string;
  em: boolean;
}
export interface LaidToken extends Token {
  w: number;
}
export interface LaidLine {
  tokens: LaidToken[];
  width: number;
}
export interface TextLayout {
  lines: LaidLine[];
  /** Visible characters (code points), the unit `reveal` counts in. */
  chars: number;
  width: number;
}

/** Font size in px from a CSS font shorthand, used by the canvas-less fallback. */
function fontSize(font: string): number {
  const m = /(\d+(?:\.\d+)?)px/.exec(font);
  return m?.[1] !== undefined ? Number(m[1]) : 16;
}

/**
 * Canvas-less estimate: CJK and full-width forms take a full em, everything else
 * roughly half. Only used where no 2D context exists (Node without a DOM), so
 * layout stays deterministic there instead of throwing.
 */
export const approximateMeasurer: TextMeasurer = (font, text) => {
  const size = fontSize(font);
  let width = 0;
  for (const ch of text) width += (ch.codePointAt(0) ?? 0) >= 0x2e80 ? size : size * 0.55;
  return width;
};

function canvasMeasurer(): TextMeasurer | null {
  try {
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(8, 8)
        : typeof document !== "undefined"
          ? document.createElement("canvas")
          : null;
    const ctx = canvas?.getContext("2d") ?? null;
    if (ctx === null) return null;
    return (font, text) => {
      ctx.font = font;
      return ctx.measureText(text).width;
    };
  } catch {
    return null;
  }
}

let measurer: TextMeasurer | null = null;
const widthCache = new Map<string, number>();
const layoutCache = new Map<string, TextLayout>();

/** Replace how text is measured (tests, or a host with its own canvas). `null` restores the default. */
export function setTextMeasurer(next: TextMeasurer | null): void {
  measurer = next;
  clearTextCaches();
}

/** Drop cached widths — required after web fonts finish loading, since widths change. */
export function clearTextCaches(): void {
  widthCache.clear();
  layoutCache.clear();
}

function measure(font: string, text: string): number {
  const key = `${font}\u0000${text}`;
  const hit = widthCache.get(key);
  if (hit !== undefined) return hit;
  measurer ??= canvasMeasurer() ?? approximateMeasurer;
  const width = measurer(font, text);
  widthCache.set(key, width);
  return width;
}

/** Split text into tokens; `**...**` toggles emphasis. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  text.split("**").forEach((part, i) => {
    const em = i % 2 === 1;
    for (const m of part.matchAll(TOKEN_RE)) tokens.push({ s: m[0], em });
  });
  return tokens;
}

export { plainText } from "./plain-text.ts";

/** Wrap `text` to `maxWidth` with Japanese line-start rules and `**emphasis**`. */
export function layoutText(
  text: string,
  font: string,
  emFont: string,
  maxWidth: number,
): TextLayout {
  const key = [text, font, emFont, maxWidth].join("\u0001");
  const hit = layoutCache.get(key);
  if (hit !== undefined) return hit;
  const lines: LaidLine[] = [];
  let line: LaidLine = { tokens: [], width: 0 };
  const push = () => {
    // Trailing spaces do not count towards the line width.
    let last = line.tokens.at(-1);
    while (last?.s === " ") {
      line.tokens.pop();
      line.width -= last.w;
      last = line.tokens.at(-1);
    }
    lines.push(line);
    line = { tokens: [], width: 0 };
  };
  for (const token of tokenize(text)) {
    if (token.s === "\n") {
      push();
      continue;
    }
    const w = measure(token.em ? emFont : font, token.s);
    const fits = line.width + w <= maxWidth;
    if (!fits && line.tokens.length > 0 && !NO_LINE_START.has(token.s)) {
      push();
      if (token.s === " ") continue;
    }
    line.tokens.push({ ...token, w });
    line.width += w;
  }
  push();
  let chars = 0;
  for (const l of lines) for (const t of l.tokens) chars += [...t.s].length;
  const layout = { lines, chars, width: Math.max(0, ...lines.map((l) => l.width)) };
  layoutCache.set(key, layout);
  return layout;
}
