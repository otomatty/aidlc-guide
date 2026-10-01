import path from "node:path";
import { type InstalledVideoPack, parsePackContributions } from "@aidlc-guide/official-docs";
import { type Disposable, extensions } from "vscode";

/** The part of `vscode.Extension` discovery reads. */
export interface ExtensionLike {
  id: string;
  extensionPath: string;
  packageJSON: unknown;
}

/** Refusals already logged, so a bad pack is reported once rather than on every page view. */
const reported = new Set<string>();

/**
 * Doc video packs declared by the installed extensions. Packs are data-only
 * extensions from trusted publishers; anything else declaring the contribution
 * is skipped (and logged once), never partially loaded.
 */
export function discoverVideoPacks(
  all: readonly ExtensionLike[],
  warn: (message: string) => void = console.warn,
): InstalledVideoPack[] {
  const packs: InstalledVideoPack[] = [];
  for (const ext of all) {
    const result = parsePackContributions(ext.id, ext.packageJSON);
    if ("ok" in result) {
      for (const source of result.value) packs.push({ source, extensionPath: ext.extensionPath });
      continue;
    }
    const why = "error" in result ? result.reason : `unsupported pack format ${result.version}`;
    const key = `${ext.id}\u0000${why}`;
    if (!reported.has(key)) {
      reported.add(key);
      warn(`AIDLC Guide: 動画パック ${ext.id} を読み込みません（${why}）。`);
    }
  }
  return packs;
}

/** Packs installed right now. Cheap enough to ask on every request. */
export function installedVideoPacks(): InstalledVideoPack[] {
  return discoverVideoPacks(extensions.all);
}

/**
 * Directories a webview must be allowed to load from: only each pack's root,
 * never the whole extension. (`root` is already a checked relative path.)
 */
export function videoPackRoots(packs: readonly InstalledVideoPack[]): string[] {
  return [...new Set(packs.map((p) => path.resolve(p.extensionPath, p.source.root)))];
}

/** Fires when extensions are installed, removed, enabled or disabled. */
export function onVideoPacksChanged(listener: () => void): Disposable {
  return extensions.onDidChange(listener);
}
