/**
 * Which images an artifact may show, and how. An agent draws a diagram as an SVG file beside the
 * document (`diagrams/<name>.svg`) and embeds it with Markdown image syntax. The dashboard shows
 * such a file only:
 *
 * - when it names an `.svg` relative to the document, inside the document's own folder (the same
 *   boundary the focus-diagrams sensor checks; the server's guardPath keeps the record boundary
 *   behind it);
 * - read as text through `GET /api/artifact`, never loaded by the browser from an address;
 * - shown as a `data:` URL in an `<img>`, where an SVG runs no script and loads nothing.
 *
 * Anything else stays its alt text, as every image did before.
 */

/** Same cap as the sensor: a larger "diagram" is carrying pictures, not a drawing. */
export const MAX_SVG_CHARS = 1_000_000;

/** The record-relative path of an SVG the document at `documentPath` may show, or `null`. */
export function localSvgPath(documentPath: string, href: string): string | null {
  // A browser loads the file without the fragment or query after its name.
  const written = href.trim().replace(/[?#][\s\S]*$/, "");
  if (written === "" || written.includes("\\")) return null;
  // A scheme (https:, data:, file:, C:) or a root names something outside the document's folder.
  if (/^[a-z][a-z0-9+.-]*:/i.test(written) || written.startsWith("/")) return null;
  let name: string;
  try {
    name = decodeURIComponent(written);
  } catch {
    return null;
  }
  if (name.includes("\\") || !/\.svg$/i.test(name)) return null;
  const folder: string[] = documentPath.split("/").slice(0, -1);
  const inside: string[] = [];
  for (const segment of name.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (inside.length === 0) return null;
      inside.pop();
      continue;
    }
    inside.push(segment);
  }
  if (inside.length === 0) return null;
  return [...folder, ...inside].join("/");
}

/** Whether text is an SVG document: its root element, past a declaration and comments, is <svg>. */
export function isSvgDocument(text: string): boolean {
  const body = text
    .replace(/^﻿/, "")
    .replace(/^\s*<\?xml[\s\S]*?\?>/, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  return /^\s*<(?:[A-Za-z_][\w.-]*:)?svg[\s>/]/.test(body);
}

/** The drawing as a `data:` URL an `<img>` shows without fetching anything. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
