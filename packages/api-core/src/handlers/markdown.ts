/**
 * Shared bits of the two markdown catalogues (usage guides, agent knowledge):
 * the safe-filename rule and the title extraction. One definition — the
 * guides and agents handlers used to carry byte-identical copies.
 */

/** Safe markdown filenames (no path segments). */
export const MD_FILE = /^[a-z0-9][a-z0-9-]*\.md$/i;

/** First `#` heading, or a readable fallback from the filename. */
export function titleFromMarkdown(text: string, fallback: string): string {
  for (const line of text.split(/\r?\n/)) {
    const match = /^#\s+(.+)$/.exec(line.trim());
    if (match?.[1] !== undefined) return match[1].trim();
  }
  return fallback.replace(/\.md$/i, "").replace(/-/g, " ");
}
