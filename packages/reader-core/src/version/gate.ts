import path from "node:path";
import type { VersionGate } from "@aidlc-guide/shared-types";
import {
  detectHarnesses,
  findHarnessConflict,
  harnessVersionRel,
  readAllWorkspaceAidlcVersions,
  readNativeProjections,
  unreadableNativeStamps,
} from "./harness.ts";
import { inspectProjectPin, readNativeInstall } from "./native-install.ts";

/**
 * The single version check every surface enforces (docs/maintenance/version-gate-design.md).
 * The Guide reads only the format of the release it supports, so anything but
 * an exact match blocks. Synchronous file reads only: no process, no hashing.
 */

export type VersionGateDeps = {
  /** The engine version this machine resolves for the project. */
  readEngine?: (root: string) => string | null;
};

const STRICT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parts(version: string): [number, number, number] | null {
  if (!STRICT_VERSION.test(version)) return null;
  const [major, minor, patch] = version.split(".").map(Number);
  return [major ?? 0, minor ?? 0, patch ?? 0];
}

function compare(left: [number, number, number], right: [number, number, number]): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

function defaultEngine(root: string): string | null {
  return readNativeInstall(root)?.version ?? null;
}

export function inspectVersionGate(
  root: string,
  target: string,
  deps: VersionGateDeps = {},
): VersionGate {
  const detected = detectHarnesses(root).harnesses;
  const projections = readNativeProjections(root);
  const records = readAllWorkspaceAidlcVersions(root);
  const pin = inspectProjectPin(root);
  const tools = detected.map((tool) => ({
    ...tool,
    version:
      projections.find((entry) => entry.harness === tool.id)?.version ??
      records.find((entry) => entry.sourcePath === path.join(root, harnessVersionRel(tool.id)))
        ?.version ??
      null,
  }));
  const native = projections.length > 0;
  // A native project's screen always names this machine's engine, whichever
  // status it shows; null then means "not installed", never "not checked".
  const engine = native ? (deps.readEngine ?? defaultEngine)(root) : null;
  const base = { target, tools, pin: pin.version, engine, native };
  const unknown = (message: string): VersionGate => ({ ...base, status: "unknown", message });
  const newer = (version: string): VersionGate => ({
    ...base,
    status: "project-newer",
    message: `プロジェクトの aidlc-workflows ${version} は、この Guide の対応版 ${target} より新しいバージョンです。Guide を更新してください。`,
  });
  const wanted = parts(target);
  if (wanted === null) return unknown(`Guide の対応版 ${target} を確認できません。`);

  // A pin that cannot be read is repaired in Doctor, not by Setup, even with no tool.
  if (pin.exists && pin.version === null)
    return unknown(
      "プロジェクトの固定バージョン（.aidlc-version）を読めません。Doctor で確認してください。",
    );
  // A stamp left by an interrupted install is Doctor's, even before any tool is detected.
  if (unreadableNativeStamps(root).length > 0)
    return unknown(
      "ツールの導入記録（aidlc-stamp.json）を読めません。更新が途中で止まった可能性があります。Doctor で確認してください。",
    );
  if (tools.length === 0) {
    // Setup refuses to downgrade a newer pin, so only a Guide update helps.
    const pinAt = pin.version === null ? null : parts(pin.version);
    if (pin.version !== null && pinAt !== null && compare(pinAt, wanted) > 0)
      return newer(pin.version);
    return {
      ...base,
      status: "not-installed",
      message:
        "このプロジェクトには aidlc-workflows が設定されていません。セットアップしてください。",
    };
  }
  const conflict = findHarnessConflict(detected.map((tool) => tool.id));
  if (conflict) return unknown(conflict.message);
  const versions = [
    ...tools.map((tool) => tool.version),
    ...records.map((record) => record.version),
    ...(pin.version === null ? [] : [pin.version]),
  ];
  const parsed: { version: string; at: [number, number, number] }[] = [];
  for (const version of versions) {
    const at = version === null ? null : parts(version);
    if (version === null || at === null)
      return unknown("バージョンを確認できないツールがあります。Doctor で確認してください。");
    parsed.push({ version, at });
  }

  const newest = parsed.reduce((a, b) => (compare(b.at, a.at) > 0 ? b : a));
  if (compare(newest.at, wanted) > 0) return newer(newest.version);
  const oldest = parsed.reduce((a, b) => (compare(b.at, a.at) < 0 ? b : a));
  if (compare(oldest.at, wanted) < 0)
    return {
      ...base,
      status: "project-older",
      message: `プロジェクトの aidlc-workflows ${oldest.version} は、この Guide の対応版 ${target} より古いバージョンです。プロジェクトを ${target} に更新してください。`,
    };

  // A copy-channel tree is the engine itself; only a native project runs a machine binary.
  if (!native) return { ...base, status: "ok", message: "プロジェクトは対応版です。" };
  if (engine !== target)
    return {
      ...base,
      status: "engine-mismatch",
      message:
        engine === null
          ? `この PC に aidlc-workflows ${target} のエンジンが導入されていません。この PC に ${target} を導入してください。`
          : `この PC のエンジンは ${engine} です。プロジェクトの ${target} に合わせて導入してください。`,
    };
  return { ...base, status: "ok", message: "プロジェクトとエンジンは対応版です。" };
}
