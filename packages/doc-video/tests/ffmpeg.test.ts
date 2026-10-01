import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ffmpegAudio, renderTone } from "../src/audio.ts";

// Real ffmpeg end to end. GitHub's runners ship ffmpeg; a contributor
// machine without it skips this file rather than failing on a missing tool.
const hasFfmpeg =
  spawnSync("ffmpeg", ["-hide_banner", "-encoders"]).stdout?.toString().includes("libopus") === true &&
  spawnSync("ffprobe", ["-version"]).status === 0;

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "doc-video-ffmpeg-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe.skipIf(!hasFfmpeg)("ffmpeg narration pipeline", () => {
  it("renders, trims, measures and mixes into Ogg/Opus", async () => {
    const raw = renderTone(1.2);
    expect(new TextDecoder().decode(raw.slice(0, 4))).toBe("RIFF");
    const clip = path.join(dir, "clip.wav");
    await ffmpegAudio.trim(raw, clip);
    const seconds = await ffmpegAudio.duration(clip);
    expect(seconds).toBeGreaterThan(1.1);
    expect(seconds).toBeLessThan(1.3);
    const out = path.join(dir, "narration.opus");
    await ffmpegAudio.mix([{ file: clip, start: 0.5 }, { file: clip, start: 2 }], 4, out);
    expect(new TextDecoder().decode((await readFile(out)).slice(0, 4))).toBe("OggS");
    expect(await ffmpegAudio.duration(out)).toBeCloseTo(4, 0);
  });

  it("reports ffmpeg failures and unmeasurable files", async () => {
    await expect(ffmpegAudio.trim(new Uint8Array([1, 2, 3]), path.join(dir, "bad.wav"))).rejects.toThrow(/ffmpeg failed/);
    await expect(ffmpegAudio.duration(path.join(dir, "missing.wav"))).rejects.toThrow(/ffprobe failed/);
  });
});
