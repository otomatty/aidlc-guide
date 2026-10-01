#!/usr/bin/env bun
/**
 * Doc video tooling (maintainers only).
 *
 *   bun run video voice <pageDir> [--provider tone]   narrate a page: timeline, captions, narration.opus
 *   bun run video voices <pageDir>                     one caption in every Grok voice, for choosing
 *   bun run video pack <packDir>                       build a video pack's media from docs/videos
 *   bun run video check                                validate every pack's sources (`bun run check`)
 *
 * Grok TTS reads XAI_API_KEY from the environment (bun also loads it from a
 * gitignored `.env`). `--provider tone` narrates with a soft tone instead, so
 * the pipeline and playback sync can be checked without a key.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { ffmpegAudio, renderTone } from "./audio.ts";
import { planPacks, writePack } from "./pack.ts";
import { estimateSpeechSeconds } from "./timeline.ts";
import {
  createGrokTts,
  createToneTts,
  estimateGrokCostUsd,
  GROK_VOICES,
  type TtsProvider,
} from "./tts.ts";
import {
  loadVoiceConfig,
  pendingCharacters,
  readStoryboard,
  speechFor,
  type VoiceConfig,
  voicePage,
} from "./voice.ts";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const cacheDir = path.join(repoRoot, ".cache", "doc-video");

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
}

function provider(kind: VoiceConfig["provider"]): TtsProvider {
  if (kind === "tone") return createToneTts(renderTone, estimateSpeechSeconds);
  const apiKey = process.env.XAI_API_KEY ?? "";
  if (apiKey === "") {
    throw new Error(
      "XAI_API_KEY is not set. Put it in the environment or a gitignored .env, or use --provider tone.",
    );
  }
  return createGrokTts({ apiKey });
}

async function voice(pageDir: string, args: string[]): Promise<void> {
  const loaded = await loadVoiceConfig(pageDir);
  const config: VoiceConfig = {
    ...loaded,
    provider: (option(args, "provider") as VoiceConfig["provider"] | undefined) ?? loaded.provider,
    voice: option(args, "voice") ?? loaded.voice,
  };
  const tts = provider(config.provider);
  const storyboard = await readStoryboard(pageDir);
  if (tts.id === "grok") {
    const chars = pendingCharacters(storyboard, tts.id, config, cacheDir);
    const cost = estimateGrokCostUsd(chars);
    console.log(`Grok TTS: ${chars} characters to synthesize ≈ $${cost.toFixed(4)}`);
    if (cost > config.budgetUsd) {
      throw new Error(
        `estimate exceeds budgetUsd ($${config.budgetUsd}); raise it in voice.json to continue`,
      );
    }
  }
  const result = await voicePage(pageDir, { provider: tts, config, audio: ffmpegAudio, cacheDir });
  console.log(
    `${path.relative(repoRoot, pageDir)}: ${result.timeline.duration}s ` +
      `(${result.synthesized} synthesized, ${result.cached} from cache, voice ${config.voice})`,
  );
}

async function voices(pageDir: string): Promise<void> {
  const config = await loadVoiceConfig(pageDir);
  const storyboard = await readStoryboard(pageDir);
  const cue = storyboard.chapters.flatMap((c) => c.cues).at(1) ?? storyboard.chapters[0]?.cues[0];
  if (cue === undefined) throw new Error("storyboard has no captions");
  const text = speechFor(cue, config.readings);
  const tts = provider("grok");
  const out = path.join(cacheDir, "samples");
  await mkdir(out, { recursive: true });
  console.log(`sample text: ${text}`);
  for (const name of GROK_VOICES) {
    const raw = await tts.synthesize({ text, voice: name, language: config.language });
    const clip = path.join(out, `${name}.wav`);
    await ffmpegAudio.trim(raw, clip);
    await ffmpegAudio.mix(
      [{ file: clip, start: 0 }],
      await ffmpegAudio.duration(clip),
      path.join(out, `${name}.opus`),
    );
    console.log(`  ${path.relative(repoRoot, path.join(out, `${name}.opus`))}`);
  }
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
  const [command, target, ...rest] = process.argv.slice(2);
  if (command === "voice" && target !== undefined) await voice(path.resolve(target), rest);
  else if (command === "voices" && target !== undefined) await voices(path.resolve(target));
  else if (command === "pack" && target !== undefined) await pack(target);
  else if (command === "check") process.exitCode = (await check()) ? 0 : 1;
  else {
    console.error(
      "usage: video voice <pageDir> [--provider tone] [--voice <name>] | video voices <pageDir> | video pack <packDir> | video check",
    );
    process.exitCode = 2;
  }
}
