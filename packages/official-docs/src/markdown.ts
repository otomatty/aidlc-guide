/**
 * Heading / title helpers. Anchor matching follows GitHub's slug algorithm
 * (same rule as docs-bridge excerpts) so deep links stay stable.
 */

export function slugifyHeading(heading: string): string {
  return heading
    .replace(/^#{1,6}\s*/, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, "")
    .replace(/\s/g, "-");
}

function normalizeAnchor(anchor: string): string {
  return slugifyHeading(anchor.trim().replace(/^#/, ""));
}

function headingLevel(line: string): number {
  const match = /^(#{1,6})\s/.exec(line);
  return match?.[1]?.length ?? 0;
}

/** First ATX h1 title text, if any. */
export function extractTitle(markdown: string): string | undefined {
  let fence: string | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const fenceMark = /^\s*(```+|~~~+)/.exec(line)?.[1];
    if (fenceMark !== undefined) {
      // fenceMark is ```+ or ~~~+, so charAt(0) is the fence char.
      if (fence === null) fence = fenceMark.charAt(0);
      else if (fenceMark.startsWith(fence)) fence = null;
      continue;
    }
    if (fence !== null) continue;
    if (headingLevel(line) === 1) {
      const title = line.replace(/^#\s+/, "").trim();
      return title === "" ? undefined : title;
    }
  }
  return undefined;
}

/** True when some ATX heading slug equals the requested anchor. */
export function headingExists(markdown: string, anchor: string): boolean {
  const wanted = normalizeAnchor(anchor);
  if (wanted === "") return false;

  let fence: string | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const fenceMark = /^\s*(```+|~~~+)/.exec(line)?.[1];
    if (fenceMark !== undefined) {
      if (fence === null) fence = fenceMark.charAt(0);
      else if (fenceMark.startsWith(fence)) fence = null;
      continue;
    }
    if (fence !== null) continue;
    if (headingLevel(line) === 0) continue;
    if (slugifyHeading(line) === wanted) return true;
  }
  return false;
}
