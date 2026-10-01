/**
 * Assemble a video pack extension from the reviewed sources under
 * `docs/videos/<locale>/<section>/<page>/`, and check those sources in the
 * quality gate. The pack's runtime contract (`contributes.aidlcGuideVideoPacks`)
 * and the manifest format are owned by `official-docs/video-pack.ts`; this
 * file only produces what that validator accepts.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseStoryboard,
  parseTimeline,
  type Storyboard,
  type Timeline,
} from "@aidlc-guide/kamishibai/storyboard";
import {
  isDocSection,
  packBudgetViolations,
  parseDocPath,
  parsePackContributions,
  VIDEO_FILES,
  VIDEO_PACK_MANIFEST,
  type VideoPackManifest,
  type VideoPackSource,
  type VideoPageEntry,
} from "@aidlc-guide/official-docs";
import { DOC_VIDEO_TEMPLATES } from "@aidlc-guide/shared-types";

/** `<packDir>/video-pack.config.json`: which doc sections each declared pack carries. */
export const PACK_CONFIG = "video-pack.config.json";

const LFS_POINTER = "version https://git-lfs.github.com/spec/v1";

export interface PagePlan {
  docPath: string;
  /** Source page directory under `docs/videos/`. */
  sourceDir: string;
  /** Page directory relative to the pack root, as the manifest records it. */
  dir: string;
  entry: VideoPageEntry;
  /** The narration is a Git LFS pointer (checkout without `git lfs pull`). */
  pointer: boolean;
}

export interface PackPlan {
  source: VideoPackSource;
  pages: PagePlan[];
  errors: string[];
  warnings: string[];
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8")) as unknown;
}

/** Real size of a file, or the size an LFS pointer stands for. */
async function narrationSize(file: string): Promise<{ bytes: number; pointer: boolean }> {
  const info = await stat(file);
  if (info.size < 512) {
    const text = await readFile(file, "utf8");
    if (text.startsWith(LFS_POINTER)) {
      const size = /^size (\d+)$/m.exec(text)?.[1];
      return { bytes: size === undefined ? 0 : Number(size), pointer: true };
    }
  }
  return { bytes: info.size, pointer: false };
}

/** Do the storyboard and timeline describe the same chapters and captions? */
export function agreement(storyboard: Storyboard, timeline: Timeline): string | null {
  if (storyboard.chapters.length !== timeline.chapters.length) return "chapter count differs";
  for (const [i, chapter] of storyboard.chapters.entries()) {
    const times = timeline.chapters[i];
    if (times?.id !== chapter.id) return `chapter ${i} is ${chapter.id} in the storyboard`;
    if (times.cues.length !== chapter.cues.length)
      return `chapter ${chapter.id}: caption count differs`;
  }
  return null;
}

async function pageDirs(root: string): Promise<string[]> {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = async (dir: string) => {
    const entries = await readdir(dir, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && e.name === VIDEO_FILES.storyboard)) out.push(dir);
    for (const e of entries) if (e.isDirectory()) await walk(path.join(dir, e.name));
  };
  await walk(root);
  return out.sort();
}

async function planPage(
  repoRoot: string,
  locale: string,
  sourceDir: string,
  errors: string[],
  warnings: string[],
): Promise<PagePlan | null> {
  const localeRoot = path.join(repoRoot, "docs", "videos", locale);
  const rel = path.relative(localeRoot, sourceDir).split(path.sep).join("/");
  const docPath = `${rel}.md`;
  const where = `docs/videos/${locale}/${rel}`;
  const parsed = parseDocPath(docPath);
  if (parsed === null) {
    errors.push(`${where}: not under a documentation section`);
    return null;
  }
  // A page is a draft until its narration exists: the script and storyboard
  // are reviewed first, audio is generated afterwards. Drafts are checked but
  // never packed.
  const draft = !existsSync(path.join(sourceDir, VIDEO_FILES.narration));
  const required = draft ? [VIDEO_FILES.storyboard] : Object.values(VIDEO_FILES);
  for (const file of required) {
    if (!existsSync(path.join(sourceDir, file))) errors.push(`${where}: missing ${file}`);
  }
  if (errors.some((e) => e.startsWith(`${where}:`))) return null;

  const storyboard = parseStoryboard(await readJson(path.join(sourceDir, VIDEO_FILES.storyboard)));
  if (!storyboard.ok) {
    errors.push(`${where}: ${storyboard.error}`);
    return null;
  }
  const sb = storyboard.value;
  if (sb.page !== docPath)
    errors.push(`${where}: storyboard page is ${sb.page}, expected ${docPath}`);
  const known = new Set<string>(DOC_VIDEO_TEMPLATES);
  const templates = [...new Set(sb.chapters.map((c) => c.template))];
  for (const t of templates) if (!known.has(t)) errors.push(`${where}: unknown template ${t}`);

  const original = path.join(repoRoot, "docs", parsed.section, "en", parsed.relFile);
  if (!existsSync(original)) {
    errors.push(`${where}: no English original at docs/${parsed.section}/en/${parsed.relFile}`);
  } else {
    const hash = createHash("sha256")
      .update(await readFile(original, "utf8"))
      .digest("hex");
    if (hash !== sb.sourceHash)
      warnings.push(`${where}: stale — the English page changed after the script`);
  }
  if (draft) {
    if (!errors.some((e) => e.startsWith(`${where}:`))) {
      warnings.push(`${where}: draft — no ${VIDEO_FILES.narration} yet, not packed`);
    }
    return null;
  }

  const timeline = parseTimeline(await readJson(path.join(sourceDir, VIDEO_FILES.timeline)));
  if (!timeline.ok) {
    errors.push(`${where}: ${timeline.error}`);
    return null;
  }
  const mismatch = agreement(sb, timeline.value);
  if (mismatch !== null) errors.push(`${where}: storyboard and timeline disagree (${mismatch})`);
  if (errors.some((e) => e.startsWith(`${where}:`))) return null;

  const narration = await narrationSize(path.join(sourceDir, VIDEO_FILES.narration));
  let bytes = narration.bytes;
  for (const file of [VIDEO_FILES.storyboard, VIDEO_FILES.timeline, VIDEO_FILES.captions]) {
    bytes += (await stat(path.join(sourceDir, file))).size;
  }
  const dir = `${locale}/${rel}`;
  return {
    docPath,
    sourceDir,
    dir,
    pointer: narration.pointer,
    entry: {
      path: docPath,
      dir,
      sourceHash: sb.sourceHash,
      templates,
      durationSec: timeline.value.duration,
      bytes,
    },
  };
}

/** Read a pack directory and plan every pack it declares. */
export async function planPacks(repoRoot: string, packDir: string): Promise<PackPlan[]> {
  const pkg = await readJson(path.join(packDir, "package.json"));
  const record = (pkg ?? {}) as { publisher?: unknown; name?: unknown };
  const extensionId = `${String(record.publisher)}.${String(record.name)}`;
  const declared = parsePackContributions(extensionId, pkg);
  if (!("ok" in declared) || declared.value.length === 0) {
    throw new Error(`${packDir}: package.json does not declare a valid video pack`);
  }
  const config = (await readJson(path.join(packDir, PACK_CONFIG))) as Record<
    string,
    { sections?: unknown }
  >;
  const plans: PackPlan[] = [];
  for (const source of declared.value) {
    const sections = config[source.id]?.sections;
    if (
      !Array.isArray(sections) ||
      !sections.every((s): s is string => typeof s === "string" && isDocSection(s))
    ) {
      throw new Error(`${packDir}/${PACK_CONFIG}: ${source.id} needs a list of doc sections`);
    }
    const errors: string[] = [];
    const warnings: string[] = [];
    const pages: PagePlan[] = [];
    for (const section of sections) {
      for (const dir of await pageDirs(
        path.join(repoRoot, "docs", "videos", source.locale, section),
      )) {
        const page = await planPage(repoRoot, source.locale, dir, errors, warnings);
        if (page !== null) pages.push(page);
      }
    }
    for (const v of packBudgetViolations({ pages: pages.map((p) => p.entry) }))
      errors.push(`${source.id}: ${v}`);
    plans.push({ source, pages, errors, warnings });
  }
  return plans;
}

/** Copy the planned pages into the pack's media root and write its manifest. */
export async function writePack(
  packDir: string,
  plan: PackPlan,
  builtAt: Date,
): Promise<VideoPackManifest> {
  if (plan.errors.length > 0)
    throw new Error(`${plan.source.id} has errors:\n${plan.errors.join("\n")}`);
  const pointers = plan.pages.filter((p) => p.pointer).map((p) => p.docPath);
  if (pointers.length > 0) {
    throw new Error(
      `narration is a Git LFS pointer (run \`git lfs pull\`): ${pointers.join(", ")}`,
    );
  }
  const root = path.join(packDir, plan.source.root);
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  for (const page of plan.pages) {
    const dest = path.join(root, ...page.dir.split("/"));
    await mkdir(dest, { recursive: true });
    for (const file of Object.values(VIDEO_FILES)) {
      await cp(path.join(page.sourceDir, file), path.join(dest, file));
    }
  }
  const manifest: VideoPackManifest = {
    formatVersion: 1,
    packId: plan.source.id,
    locale: plan.source.locale,
    builtAt: builtAt.toISOString(),
    pages: plan.pages.map((p) => p.entry),
  };
  await writeFile(path.join(root, VIDEO_PACK_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
