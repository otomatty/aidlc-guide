/**
 * ffmpeg/ffprobe steps of the narration pipeline. The argument builders are
 * pure (unit-tested); `ffmpegAudio` runs them.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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

const QUIET = ["-hide_banner", "-loglevel", "error", "-y"] as const;
/** TTS output rate; clips are kept at it until the final encode. */
const CLIP_RATE = 24000;
/** Silence trim: below -45 dB, keeping 50 ms at each edge. */
const TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05";

/** Trim leading and trailing silence and normalise a clip to mono 24 kHz WAV. */
export function trimSilenceArgs(input: string, output: string): string[] {
  return [
    ...QUIET,
    "-i",
    input,
    "-af",
    `${TRIM},areverse,${TRIM},areverse`,
    "-ar",
    String(CLIP_RATE),
    "-ac",
    "1",
    output,
  ];
}

export function durationArgs(file: string): string[] {
  return ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file];
}

/**
 * Place every clip at its caption's start, pad to the video's length,
 * normalise loudness to -16 LUFS / -1.5 dBTP, and encode the pack format.
 */
export function mixNarrationArgs(
  clips: readonly { file: string; start: number }[],
  duration: number,
  output: string,
): string[] {
  if (clips.length === 0) throw new Error("narration needs at least one clip");
  const inputs = clips.flatMap((c) => ["-i", c.file]);
  const delays = clips
    .map((c, i) => `[${i}]adelay=${Math.round(c.start * 1000)}:all=1[d${i}]`)
    .join(";");
  const labels = clips.map((_, i) => `[d${i}]`).join("");
  const filter = `${delays};${labels}amix=inputs=${clips.length}:normalize=0,apad,atrim=0:${duration},loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  return [
    ...QUIET,
    ...inputs,
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    "-ar",
    "48000",
    ...NARRATION_ENCODING,
    output,
  ];
}

/** A soft test tone of `seconds`, as WAV on stdout (stand-in narration). */
export function toneArgs(seconds: number): string[] {
  return [
    ...QUIET,
    "-f",
    "lavfi",
    "-i",
    `sine=f=440:r=${CLIP_RATE}:d=${seconds.toFixed(3)}`,
    "-af",
    "volume=0.15",
    "-f",
    "wav",
    "pipe:1",
  ];
}

export interface AudioOps {
  /** Write `raw` (any format) as a trimmed WAV clip at `output`. */
  trim(raw: Uint8Array, output: string): Promise<void>;
  duration(file: string): Promise<number>;
  mix(
    clips: readonly { file: string; start: number }[],
    duration: number,
    output: string,
  ): Promise<void>;
}

function run(command: string, args: string[]): Buffer {
  const result = spawnSync(command, args, { maxBuffer: 64 * 1024 * 1024 });
  if (result.error)
    throw new Error(`${command} could not start (is it installed?): ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr.toString().trim()}`);
  return result.stdout;
}

/** The real implementation, backed by ffmpeg and ffprobe on PATH. */
export const ffmpegAudio: AudioOps = {
  async trim(raw, output) {
    const dir = mkdtempSync(path.join(tmpdir(), "doc-video-"));
    try {
      const input = path.join(dir, "raw");
      writeFileSync(input, raw);
      run("ffmpeg", trimSilenceArgs(input, output));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  async duration(file) {
    const seconds = Number(run("ffprobe", durationArgs(file)).toString().trim());
    if (!Number.isFinite(seconds)) throw new Error(`could not measure ${file}`);
    return seconds;
  },
  async mix(clips, duration, output) {
    run("ffmpeg", mixNarrationArgs(clips, duration, output));
  },
};

/** Render a tone with ffmpeg (used by the stand-in provider). */
export function renderTone(seconds: number): Uint8Array {
  return new Uint8Array(run("ffmpeg", toneArgs(seconds)));
}
