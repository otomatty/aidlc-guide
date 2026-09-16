import { createHash, randomUUID } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { assertNoActiveWorkflows } from "./native-harness-install.ts";
import { acquireNativeWorkspaceLock } from "./native-workspace-lock.ts";

// Deliberately excludes application code, credentials, workflow artifacts, and runtime state.
const CONFIG = [
  ".claude",
  ".cursor",
  ".codex",
  ".agents",
  ".github/skills",
  ".github/agents",
  ".github/hooks",
  ".aidlc",
  ".opencode",
  ".kiro",
  ".gitignore",
  "AGENTS.md",
  ".mcp.json",
  ".vscode/settings.json",
  "opencode.json",
  "install.ts",
  "aidlc.settings.json",
  "aidlc.settings.local.json",
];
export type RepairFile = { bytes: Buffer; mode: number };
export type RepairSnapshot = Map<string, RepairFile>;
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
export const repairHash = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");

export function repairPath(root: string, rel: string): string {
  if (!rel || /[\\:\0]/.test(rel) || rel.split("/").some((p) => !p || p === "." || p === ".."))
    throw new Error(`不正な設定パスです: ${rel}`);
  let target = realpathSync(root);
  for (const part of rel.split("/")) {
    target = path.join(target, part);
    try {
      const stat = lstatSync(target);
      if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()))
        throw new Error(`リンクや特殊ファイルは修正できません: ${rel}`);
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  return target;
}

/** Bounded snapshot also detects additions while AI is running. */
export function snapshotRepairFiles(root: string): RepairSnapshot {
  const files: RepairSnapshot = new Map();
  let size = 0;
  const collect = (rel: string) => {
    const file = repairPath(root, rel);
    let stat: ReturnType<typeof lstatSync>;
    try {
      stat = lstatSync(file);
    } catch (error) {
      if (missing(error)) return;
      throw error;
    }
    if (stat.isDirectory()) {
      for (const entry of readdirSync(file).sort()) collect(`${rel}/${entry}`);
    } else {
      size += stat.size;
      if (size > 64_000_000 || files.size >= 12_000)
        throw new Error("設定が大きすぎるため自動修正できません。");
      files.set(rel, { bytes: readFileSync(file), mode: stat.mode & 0o777 });
    }
  };
  for (const rel of [...CONFIG, ".aidlc-version", "aidlc/active-space"]) collect(rel);
  const spaces = repairPath(root, "aidlc/spaces");
  try {
    for (const space of readdirSync(spaces).sort()) collect(`aidlc/spaces/${space}/memory`);
  } catch (error) {
    if (!missing(error)) throw error;
  }
  return files;
}

export function snapshotHash(files: RepairSnapshot): string {
  return repairHash(
    JSON.stringify(
      [...files]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([rel, f]) => [rel, repairHash(f.bytes), f.mode]),
    ),
  );
}

export function seedRepairFiles(stage: string, files: RepairSnapshot): void {
  for (const [rel, file] of files) {
    if (rel === ".aidlc-version") continue; // Always inspect with the explicit target distribution.
    const destination = repairPath(stage, rel);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, file.bytes, { mode: file.mode, flag: "wx" });
  }
}

/** The only repair writer. AI cannot supply paths or content to this function directly. */
export async function commitRepairFiles(options: {
  root: string;
  stage: string;
  before: RepairSnapshot;
  backupParent: string;
  signal: AbortSignal;
  isCurrent(): boolean;
}): Promise<{ backup: string; changed: string[] }> {
  const check = () => {
    options.signal.throwIfAborted();
    if (!options.isCurrent()) throw new Error("修正を中止しました。");
  };
  check();
  const after = snapshotRepairFiles(options.stage);
  // The official CLI may seed memory in the staging folder; never import those writes.
  const allowed = (rel: string) =>
    CONFIG.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`));
  const changes = [...new Set([...options.before.keys(), ...after.keys()])].filter((rel) => {
    if (!allowed(rel)) return false;
    const old = options.before.get(rel),
      next = after.get(rel);
    return !old || !next || !old.bytes.equals(next.bytes) || old.mode !== next.mode;
  });
  if (!changes.length) return { backup: "", changed: [] };
  const release = await acquireNativeWorkspaceLock(options.root, options);
  const applied: string[] = [];
  let backup = "";
  const replace = (rel: string, file: RepairFile | undefined) => {
    const destination = repairPath(options.root, rel);
    if (!file) {
      unlinkSync(destination);
      return;
    }
    mkdirSync(path.dirname(destination), { recursive: true });
    const temp = `${destination}.repair-${randomUUID()}.tmp`;
    try {
      writeFileSync(temp, file.bytes, { flag: "wx", mode: file.mode });
      renameSync(temp, destination);
    } finally {
      try {
        unlinkSync(temp);
      } catch (error) {
        if (!missing(error)) console.error("修正用一時ファイルを削除できませんでした。", error);
      }
    }
  };
  try {
    await assertNoActiveWorkflows(options.root);
    check();
    if (snapshotHash(snapshotRepairFiles(options.root)) !== snapshotHash(options.before))
      throw new Error(
        "診断後に設定が変更されました。修正を適用せず停止しました。再診断してください。",
      );
    mkdirSync(options.backupParent, { recursive: true });
    backup = path.join(options.backupParent, randomUUID());
    mkdirSync(backup, { mode: 0o700 });
    for (const [index, rel] of changes.entries()) {
      const file = options.before.get(rel);
      if (file)
        writeFileSync(path.join(backup, `${index}.bin`), file.bytes, { flag: "wx", mode: 0o600 });
    }
    writeFileSync(
      path.join(backup, "manifest.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          root: realpathSync(options.root),
          status: "prepared",
          changes: changes.map((rel, index) => ({
            path: rel,
            backup: options.before.has(rel) ? `${index}.bin` : null,
            mode: options.before.get(rel)?.mode,
            after: after.get(rel) ? repairHash(after.get(rel)?.bytes ?? "") : null,
          })),
        },
        null,
        2,
      ),
      { flag: "wx", mode: 0o600 },
    );
    // Synchronous commit: no asynchronous AI work occurs inside the transaction.
    for (const rel of changes) {
      check();
      const current = options.before.get(rel);
      const destination = repairPath(options.root, rel);
      let bytes: Buffer | undefined;
      try {
        bytes = readFileSync(destination);
      } catch (error) {
        if (!missing(error)) throw error;
      }
      if (current ? !bytes?.equals(current.bytes) : bytes !== undefined)
        throw new Error(`適用直前に変更されました: ${rel}`);
      replace(rel, after.get(rel));
      applied.push(rel);
    }
    writeFileSync(path.join(backup, "completed"), new Date().toISOString(), {
      flag: "wx",
      mode: 0o600,
    });
    return { backup, changed: changes };
  } catch (error) {
    const failed: string[] = [];
    for (const rel of applied.reverse()) {
      try {
        const expected = after.get(rel);
        let current: Buffer | undefined;
        try {
          current = readFileSync(repairPath(options.root, rel));
        } catch (e) {
          if (!missing(e)) throw e;
        }
        if (expected ? !current?.equals(expected.bytes) : current !== undefined)
          throw new Error("changed");
        replace(rel, options.before.get(rel));
      } catch {
        failed.push(rel);
      }
    }
    if (failed.length)
      throw new Error(`復元できない設定があります: ${failed.join("、")}。バックアップ: ${backup}`, {
        cause: error,
      });
    throw error;
  } finally {
    release();
  }
}
