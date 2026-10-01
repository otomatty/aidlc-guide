/**
 * The narration file format a pack ships: Ogg/Opus, mono, low bitrate. VS Code
 * webviews cannot decode AAC, and Opus at 12 kbps keeps a three-minute page
 * near 270 KB, which is what lets ~100 pages fit the 30 MB pack budget.
 */
export const NARRATION_ENCODING = [
  "-ac",
  "1",
  "-c:a",
  "libopus",
  "-b:a",
  "12k",
  "-application",
  "voip",
] as const;

/** Placeholder tone: short, quiet, one per caption start. */
const BEEP = { frequency: 880, seconds: 0.12, volume: 0.3, sampleRate: 24000 } as const;

/**
 * ffmpeg arguments for a placeholder narration track: silence for the whole
 * video with a short beep where each caption starts. Lets the pipeline and
 * the player's audio sync be checked before real narration exists.
 */
export function placeholderNarrationArgs(
  cueStarts: readonly number[],
  duration: number,
  output: string,
): string[] {
  if (cueStarts.length === 0) throw new Error("a placeholder needs at least one caption");
  const n = cueStarts.length;
  const split = Array.from({ length: n }, (_, i) => `[b${i}]`).join("");
  const delays = cueStarts
    .map((start, i) => `[b${i}]adelay=${Math.round(start * 1000)}:all=1[d${i}]`)
    .join(";");
  const mixed = Array.from({ length: n }, (_, i) => `[d${i}]`).join("");
  const filter = [
    `[0]atrim=0:${duration}[s]`,
    `[1]volume=${BEEP.volume},asplit=${n}${split}`,
    delays,
    `[s]${mixed}amix=inputs=${n + 1}:normalize=0:duration=first[out]`,
  ].join(";");
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=${BEEP.sampleRate}:cl=mono`,
    "-f",
    "lavfi",
    "-i",
    `sine=f=${BEEP.frequency}:r=${BEEP.sampleRate}:d=${BEEP.seconds}`,
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    ...NARRATION_ENCODING,
    output,
  ];
}
