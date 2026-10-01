#!/usr/bin/env bun
/**
 * Doc video tooling (maintainers only).
 *
 *   bun run video placeholder <pageDir>   timeline, captions and a beep track from storyboard.json
 *   bun run video pack <packDir>          build a video pack's media from docs/videos
 *   bun run video check                   validate every pack's sources (part of `bun run check`)
 *
 * `placeholder` stands in for narration until TTS is wired in: it times every
 * caption from an estimated reading length and writes a quiet beep where each
 * caption starts, so packaging and playback sync can be checked end to end.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseStoryboard } from "@aidlc-guide/kamishibai/storyboard";
import { VIDEO_FILES } from "@aidlc-guide/official-docs";
import { captionsVtt, globalCues } from "./captions.ts";
import { placeholderNarrationArgs } from "./narration.ts";
import { planPacks, writePack } from "./pack.ts";
import { buildTimeline, estimateSpeechSeconds } from "./timeline.ts";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

async function placeholder(pageDir: string): Promise<void> {
  const raw = JSON.parse(
    await readFile(path.join(pageDir, VIDEO_FILES.storyboard), "utf8"),
  ) as unknown;
  const storyboard = parseStoryboard(raw);
  if (!storyboard.ok) throw new Error(`storyboard: ${storyboard.error}`);
  const sb = storyboard.value;
  const timeline = buildTimeline(
    sb,
    sb.chapters.map((c) => c.cues.map((cue) => estimateSpeechSeconds(cue.text))),
  );
  await writeFile(
    path.join(pageDir, VIDEO_FILES.timeline),
    `${JSON.stringify(timeline, null, 2)}\n`,
  );
  await writeFile(path.join(pageDir, VIDEO_FILES.captions), captionsVtt(sb, timeline));
  const starts = globalCues(sb, timeline).map((c) => c.start);
  const args = placeholderNarrationArgs(
    starts,
    timeline.duration,
    path.join(pageDir, VIDEO_FILES.narration),
  );
  const ffmpeg = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (ffmpeg.status !== 0) throw new Error("ffmpeg failed (is it installed with libopus?)");
  console.log(
    `placeholder narration: ${timeline.duration}s, ${starts.length} captions → ${pageDir}`,
  );
}

async function packDirs(): Promise<string[]> {
  const packages = path.join(repoRoot, "packages");
  return (await readdir(packages))
    .filter((name) => name.startsWith("video-pack-"))
    .map((name) => path.join(packages, name))
    .filter((dir) => existsSync(path.join(dir, "package.json")));
}

async function pack(packDir: string): Promise<void> {
  for (const plan of await planPacks(repoRoot, path.resolve(packDir))) {
    for (const w of plan.warnings) console.warn(`warning: ${w}`);
    const manifest = await writePack(path.resolve(packDir), plan, new Date());
    const bytes = manifest.pages.reduce((sum, p) => sum + p.bytes, 0);
    console.log(
      `${plan.source.id}: ${manifest.pages.length} pages, ${(bytes / 1024 / 1024).toFixed(2)} MB`,
    );
  }
}

async function check(): Promise<boolean> {
  let ok = true;
  for (const dir of await packDirs()) {
    for (const plan of await planPacks(repoRoot, dir)) {
      for (const w of plan.warnings) console.warn(`warning: ${w}`);
      for (const e of plan.errors) console.error(`error: ${e}`);
      if (plan.errors.length > 0) ok = false;
      console.log(`${path.basename(dir)}/${plan.source.id}: ${plan.pages.length} pages checked`);
    }
  }
  return ok;
}

if (import.meta.main) {
  const [command, target] = process.argv.slice(2);
  if (command === "placeholder" && target !== undefined) await placeholder(path.resolve(target));
  else if (command === "pack" && target !== undefined) await pack(target);
  else if (command === "check") process.exitCode = (await check()) ? 0 : 1;
  else {
    console.error("usage: video placeholder <pageDir> | video pack <packDir> | video check");
    process.exitCode = 2;
  }
}
