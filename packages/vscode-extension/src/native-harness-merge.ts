import { createHash, randomUUID } from "node:crypto";
import {
  linkSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { HARNESS_LABELS, type HarnessId } from "./harness-detect.ts";
import { acquireNativeWorkspaceLock } from "./native-workspace-lock.ts";

export const HARNESS_DIRECTORIES: Record<HarnessId, string> = {
  claude: ".claude",
  cursor: ".cursor",
  codex: ".codex",
  copilot: ".aidlc",
  opencode: ".aidlc",
  kiro: ".kiro",
  "kiro-ide": ".kiro",
};
export const GUIDE_INSTALL_FILE = "aidlc-guide-install.json";

type Contribution = {
  policy: "managed-block" | "whole-file" | "json-map" | "json-array";
  marker?: string;
  hash?: string;
  key?: string;
  entries?: Record<string, string>;
};
type Baseline = {
  schemaVersion: number;
  frameworkVersion: string;
  distribution: string;
  harnessDir: string;
  files: Record<string, string>;
  rootContributions: Record<string, Contribution>;
};
type GuideInstall = {
  schemaVersion: number;
  harness: string;
  version: string;
  files: Record<string, string>;
};
type Change = { rel: string; before: Buffer | null; after: Buffer | null; mode: number };
type CandidatePlan = { planToken: string; root: string; changes: Change[] };
export type HarnessMergeOptions = {
  signal?: AbortSignal;
  isCurrent?: () => boolean;
  planToken?: string;
  validateLocked?: () => Promise<void>;
  onApplyStart?: () => void;
  recoverStaleLock?: () => Promise<void>;
  /** A pristine prior release with the saved plugin selection independently replayed. */
  priorCandidate?: string;
};

function digest(bytes: string | Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

/** Every source and destination is a regular file beneath its selected root. */
function safePath(root: string, rel: string): string {
  if (
    !rel ||
    /[\\:\0]/.test(rel) ||
    rel.split("/").some((part) => !part || part === ".." || part === ".")
  )
    throw new Error(`設定ファイルのパスが不正です: ${rel}`);
  const target = path.resolve(root, rel);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(`プロジェクトの外には書き込みません: ${rel}`);
  let current = root;
  for (const part of rel.split("/")) {
    current = path.join(current, part);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()))
        throw new Error(`通常のファイル・フォルダ以外には書き込みません: ${rel}`);
      if (current !== target && !stat.isDirectory())
        throw new Error(`設定先の親がフォルダではありません: ${rel}`);
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  return target;
}

function read(root: string, rel: string): Buffer | null {
  const file = safePath(root, rel);
  try {
    if (!lstatSync(file).isFile()) throw new Error(`設定先がファイルではありません: ${rel}`);
    return readFileSync(file);
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}

function json<T>(root: string, rel: string): T | null {
  const bytes = read(root, rel);
  return bytes === null ? null : (JSON.parse(bytes.toString("utf8")) as T);
}

function markers(rel: string, identity: string) {
  return rel.endsWith(".md")
    ? { begin: `<!-- BEGIN AI-DLC:${identity} -->`, end: `<!-- END AI-DLC:${identity} -->` }
    : { begin: `# BEGIN AI-DLC:${identity}`, end: `# END AI-DLC:${identity}` };
}

function blockRange(text: string, rel: string, identity: string) {
  const { begin, end } = markers(rel, identity);
  const begins = text.split(begin).length - 1;
  const ends = text.split(end).length - 1;
  if (!begins && !ends) return null;
  const start = text.indexOf(begin);
  const stop = text.indexOf(end);
  if (begins !== 1 || ends !== 1 || stop < start)
    throw new Error(`設定ブロックの区切りが不正です: ${rel}`);
  return { start, end: stop + end.length, body: text.slice(start + begin.length, stop).trim() };
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Matches the native installer's per-entry hashes, including nested object key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function jsonEntries(contribution: Contribution, rel: string): Record<string, string> {
  if (
    typeof contribution.key !== "string" ||
    !contribution.key ||
    !object(contribution.entries) ||
    Object.values(contribution.entries).some(
      (hash) => typeof hash !== "string" || !/^sha256:[a-f0-9]{64}$/.test(hash),
    )
  )
    throw new Error(`設定の JSON 所有記録を確認できません: ${rel}`);
  return contribution.entries;
}

function mergeJson(
  current: string,
  incoming: string,
  contribution: Contribution,
  rel: string,
  prior?: Contribution,
): { text: string; entries: Record<string, string> } {
  const previous: unknown = current ? JSON.parse(current) : {};
  const next: unknown = JSON.parse(incoming);
  if (!object(previous) || !object(next) || !contribution.key)
    throw new Error(`設定の JSON 形式を確認できません: ${rel}`);
  const key = contribution.key;
  const declared = jsonEntries(contribution, rel);
  const oldEntries = prior ? jsonEntries(prior, rel) : {};
  const entries: Record<string, string> = Object.create(null);
  let merged: unknown;
  if (contribution.policy === "json-array") {
    const left = Object.hasOwn(previous, key) ? previous[key] : [];
    const right = Object.hasOwn(next, key) ? next[key] : [];
    if (
      !Array.isArray(left) ||
      !Array.isArray(right) ||
      !left.every((value) => typeof value === "string") ||
      !right.every((value) => typeof value === "string")
    )
      throw new Error(`設定が文字列の配列ではありません: ${rel}`);
    if (
      right.some(
        (value) => !Object.hasOwn(declared, value) || declared[value] !== digest(canonical(value)),
      ) ||
      Object.keys(declared).some((value) => !right.includes(value))
    )
      throw new Error(`共有設定の内容がマニフェストと一致しません: ${rel}`);
    const retained = left.filter((value) => {
      const owned =
        Object.hasOwn(oldEntries, value) && oldEntries[value] === digest(canonical(value));
      if (owned && Object.hasOwn(declared, value)) entries[value] = digest(canonical(value));
      return !owned || Object.hasOwn(declared, value);
    });
    for (const value of right)
      if (!retained.includes(value)) {
        retained.push(value);
        entries[value] = digest(canonical(value));
      }
    merged = retained.length ? retained : undefined;
  } else {
    const left = Object.hasOwn(previous, key) ? previous[key] : {};
    const right = Object.hasOwn(next, key) ? next[key] : {};
    if (!object(left) || !object(right))
      throw new Error(`設定がオブジェクトではありません: ${rel}`);
    if (
      Object.entries(right).some(
        ([name, value]) =>
          !Object.hasOwn(declared, name) || declared[name] !== digest(canonical(value)),
      ) ||
      Object.keys(declared).some((name) => !Object.hasOwn(right, name))
    )
      throw new Error(`共有設定の内容がマニフェストと一致しません: ${rel}`);
    for (const [name, hash] of Object.entries(oldEntries)) {
      if (!Object.hasOwn(left, name) || Object.hasOwn(right, name)) continue;
      if (digest(canonical(left[name])) !== hash)
        throw new Error(
          `削除予定の JSON 設定が編集されています。内容を保持しました: ${rel} (${name})`,
        );
      delete left[name];
    }
    for (const [name, value] of Object.entries(right)) {
      const present = Object.hasOwn(left, name);
      const currentHash = present ? digest(canonical(left[name])) : undefined;
      const owned = Object.hasOwn(oldEntries, name);
      if (present && currentHash !== declared[name] && (!owned || currentHash !== oldEntries[name]))
        throw new Error(`既存の設定と競合しています: ${rel} (${name})`);
      Object.defineProperty(left, name, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      // Identical pre-existing user entries remain user-owned when the framework retires them.
      if (!present || owned) entries[name] = digest(canonical(value));
    }
    merged = Object.keys(left).length ? left : undefined;
  }
  // An optional integration with no owned entries has no claim on the user's key.
  if (Object.keys(declared).length === 0 && Object.keys(oldEntries).length === 0)
    return { text: current, entries };
  if (merged === undefined) delete previous[key];
  else
    Object.defineProperty(previous, key, {
      value: merged,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  const unchanged = canonical(previous) === canonical(current ? JSON.parse(current) : {});
  return { text: unchanged ? current : `${JSON.stringify(previous, null, 2)}\n`, entries };
}

function retireContribution(
  current: Buffer | null,
  contribution: Contribution,
  rel: string,
): Buffer | null {
  if (current === null) return null;
  const text = current.toString("utf8");
  if (contribution.policy === "managed-block") {
    if (!contribution.marker) throw new Error(`旧設定のブロック記録を確認できません: ${rel}`);
    const range = blockRange(text, rel, contribution.marker);
    if (!range) return current;
    if (digest(text.slice(range.start, range.end)) !== contribution.hash)
      throw new Error(`削除予定の旧設定ブロックが編集されています。内容を保持しました: ${rel}`);
    return Buffer.from(`${text.slice(0, range.start)}${text.slice(range.end)}`);
  }
  if (contribution.policy === "json-array" || contribution.policy === "json-map") {
    const retired = mergeJson(text, "{}", { ...contribution, entries: {} }, rel, contribution);
    return Buffer.from(retired.text);
  }
  if (contribution.policy === "whole-file") {
    if (digest(current) !== contribution.hash)
      throw new Error(`削除予定の旧設定が編集されています。内容を保持しました: ${rel}`);
    return null;
  }
  throw new Error(`旧共有ファイルの設定方式を確認できません: ${rel}`);
}

function readCandidate(candidate: string, harness: HarnessId, version: string) {
  const source = realpathSync(candidate);
  const dir = HARNESS_DIRECTORIES[harness];
  if (!dir) throw new Error("設定先のツールを確認できません。");
  const metadata = `${dir}/tools/data`;
  const baselineRel = `${metadata}/aidlc-manifest.json`;
  const guideRel = `${metadata}/${GUIDE_INSTALL_FILE}`;
  const stamp = json<Baseline>(source, `${metadata}/aidlc-stamp.json`);
  const baseline = json<Baseline>(source, baselineRel);
  const descriptor = json<{ managedDirectories: string[] }>(
    source,
    `${metadata}/aidlc-projection.json`,
  );
  if (
    !stamp ||
    !baseline ||
    !descriptor ||
    stamp.schemaVersion !== 1 ||
    stamp.frameworkVersion !== version ||
    stamp.distribution !== harness ||
    stamp.harnessDir !== dir ||
    baseline.schemaVersion !== 1 ||
    baseline.frameworkVersion !== version ||
    baseline.distribution !== harness ||
    baseline.harnessDir !== dir ||
    !object(baseline.files) ||
    !object(baseline.rootContributions) ||
    !Array.isArray(descriptor.managedDirectories)
  )
    throw new Error("公式の設定候補の版・ツールを確認できません。");
  const allowed = new Set([
    dir,
    "aidlc",
    ...(harness === "codex" ? [".agents"] : []),
    ...(harness === "copilot" ? [".github"] : []),
    ...(harness === "opencode" ? [".opencode"] : []),
  ]);
  for (const [rel, hash] of Object.entries(baseline.files)) {
    if (![...allowed].some((prefix) => prefix !== "aidlc" && rel.startsWith(`${prefix}/`)))
      throw new Error(`設定候補の管理対象が不正です: ${rel}`);
    const bytes = read(source, rel);
    if (bytes === null || digest(bytes) !== hash)
      throw new Error(`設定候補の内容がマニフェストと一致しません: ${rel}`);
  }
  for (const rel of descriptor.managedDirectories)
    if (!allowed.has(rel)) throw new Error(`設定候補の配置先が不正です: ${rel}`);
  return { source, dir, baselineRel, guideRel, baseline, descriptor, allowed };
}

/** Only a version upgrade with changed managed bytes needs the additional old-release replay. */
export function priorHarnessVersionForReconciliation(
  destination: string,
  harness: HarnessId,
  version: string,
): string | null {
  const root = realpathSync(destination);
  const guideRel = `${HARNESS_DIRECTORIES[harness]}/tools/data/${GUIDE_INSTALL_FILE}`;
  const prior = json<GuideInstall>(root, guideRel);
  if (!prior) return null;
  if (
    prior.schemaVersion !== 1 ||
    prior.harness !== harness ||
    typeof prior.version !== "string" ||
    !object(prior.files)
  )
    throw new Error("既存の追加設定の記録を確認できません。");
  if (prior.version === version) return null;
  return Object.entries(prior.files).some(([rel, hash]) => {
    const current = read(root, rel);
    return current !== null && digest(current) !== hash;
  })
    ? prior.version
    : null;
}

function buildPlan(
  candidate: string,
  destination: string,
  harness: HarnessId,
  version: string,
  priorCandidate?: string,
): CandidatePlan {
  const root = realpathSync(destination);
  const { source, dir, baselineRel, guideRel, baseline, descriptor, allowed } = readCandidate(
    candidate,
    harness,
    version,
  );
  const prior = json<GuideInstall>(root, guideRel);
  if (prior && (prior.schemaVersion !== 1 || prior.harness !== harness || !object(prior.files)))
    throw new Error("既存の追加設定の記録を確認できません。");
  const previousBaseline = prior ? json<Baseline>(root, baselineRel) : null;
  if (
    prior &&
    (previousBaseline?.schemaVersion !== 1 ||
      previousBaseline.distribution !== harness ||
      previousBaseline.harnessDir !== dir ||
      !object(previousBaseline.rootContributions) ||
      prior.files[baselineRel] !== digest(read(root, baselineRel) ?? ""))
  )
    throw new Error("既存の共有設定の所有記録を確認できません。");
  const replayed: Record<string, string> = Object.create(null);
  if (priorCandidate) {
    if (
      !prior ||
      typeof prior.version !== "string" ||
      previousBaseline?.frameworkVersion !== prior.version
    )
      throw new Error("再現対象の旧バージョンを確認できません。");
    const reference = readCandidate(priorCandidate, harness, prior.version);
    const collect = (rel: string): void => {
      const file = safePath(reference.source, rel);
      const stat = lstatSync(file);
      if (stat.isDirectory()) {
        for (const name of readdirSync(file).sort()) collect(`${rel}/${name}`);
      } else if (rel !== baselineRel && rel !== guideRel) {
        replayed[rel] = digest(readFileSync(file));
      }
    };
    // Shared memory is user-owned. The reference proves only independently regenerated tool files.
    for (const rel of reference.descriptor.managedDirectories) if (rel !== "aidlc") collect(rel);
  }
  const changes = new Map<string, Change>();
  const owned: Record<string, string> = {};
  const put = (rel: string, bytes: Buffer | null, mode = 0o644) => {
    if (changes.has(rel)) throw new Error(`設定候補に重複したパスがあります: ${rel}`);
    const before = read(root, rel);
    const retainedMode = before === null ? mode : lstatSync(safePath(root, rel)).mode & 0o777;
    changes.set(rel, { rel, before, after: bytes, mode: retainedMode });
  };
  const keepOrWrite = (rel: string, bytes: Buffer, mode: number, seed = false) => {
    const before = read(root, rel);
    if (seed && before !== null) return;
    if (
      before !== null &&
      !before.equals(bytes) &&
      prior?.files[rel] !== digest(before) &&
      replayed[rel] !== digest(before)
    )
      throw new Error(`既存のファイルと競合しています。内容を保持しました: ${rel}`);
    put(rel, bytes, mode);
    if (!seed) owned[rel] = digest(bytes);
  };
  const walk = (rel: string) => {
    const file = safePath(source, rel);
    const stat = lstatSync(file);
    if (stat.isDirectory()) {
      for (const name of readdirSync(file).sort()) walk(`${rel}/${name}`);
    } else {
      if (rel === baselineRel || rel === guideRel) return;
      const shared = rel.startsWith("aidlc/");
      if (shared && rel !== "aidlc/active-space" && !/^aidlc\/spaces\/[^/]+\/memory\//.test(rel))
        throw new Error(`作業記録を含む設定候補は取り込めません: ${rel}`);
      keepOrWrite(rel, readFileSync(file), stat.mode & 0o777, shared);
    }
  };
  for (const rel of descriptor.managedDirectories) {
    walk(rel);
  }
  const integrations = new Set([
    ...Object.keys(previousBaseline?.rootContributions ?? {}),
    ...Object.keys(baseline.rootContributions),
  ]);
  for (const rel of integrations) {
    if (
      ![
        "AGENTS.md",
        ".gitignore",
        ".mcp.json",
        ".vscode/settings.json",
        "opencode.json",
        "install.ts",
      ].includes(rel)
    )
      throw new Error(`未対応の共有設定ファイルです: ${rel}`);
    const contribution = baseline.rootContributions[rel];
    const previous = previousBaseline?.rootContributions[rel];
    let currentBytes = read(root, rel);
    // Retire an old key, policy, or marker before adding its replacement in the same file.
    const sameContribution =
      contribution &&
      previous &&
      contribution.policy === previous.policy &&
      (contribution.policy === "managed-block"
        ? previous.marker === `guide-${harness}-${contribution.marker ?? path.basename(rel)}`
        : contribution.key === previous.key);
    if (previous && !sameContribution)
      currentBytes = retireContribution(currentBytes, previous, rel);
    if (!contribution) {
      put(rel, currentBytes);
      continue;
    }
    let incoming = read(source, rel);
    if (incoming === null) {
      if (
        (contribution.policy === "json-map" || contribution.policy === "json-array") &&
        Object.keys(jsonEntries(contribution, rel)).length === 0
      )
        incoming = Buffer.from("{}");
      else throw new Error(`設定候補がありません: ${rel}`);
    }
    if (contribution.policy === "managed-block") {
      const originalIdentity = contribution.marker ?? path.basename(rel);
      const shipped = incoming.toString("utf8");
      const shippedRange = blockRange(shipped, rel, originalIdentity);
      if (!shippedRange) throw new Error(`公式の設定ブロックがありません: ${rel}`);
      if (digest(shipped.slice(shippedRange.start, shippedRange.end)) !== contribution.hash)
        throw new Error(`共有設定の内容がマニフェストと一致しません: ${rel}`);
      const identity = `guide-${harness}-${originalIdentity}`;
      const current = currentBytes?.toString("utf8") ?? "";
      const range = blockRange(current, rel, identity);
      const newline = current.includes("\r\n") ? "\r\n" : "\n";
      const { begin, end } = markers(rel, identity);
      let body = shippedRange.body;
      if (rel === ".gitignore") {
        // Do not import the release's generic Node/editor ignores into an existing project.
        const frameworkStart = body.search(/^# AI-DLC\b/m);
        if (frameworkStart >= 0) body = body.slice(frameworkStart);
      }
      if (rel === "AGENTS.md")
        body = `このブロックは ${HARNESS_LABELS[harness]} で AI-DLC を実行するときだけ適用します。\n\n${body}`;
      const block = `${begin}${newline}${body.replace(/\r?\n/g, newline)}${newline}${end}`;
      if (
        range &&
        current.slice(range.start, range.end) !== block &&
        (!sameContribution || previous?.hash !== digest(current.slice(range.start, range.end)))
      )
        throw new Error(`追加設定のブロックが編集されています。内容を保持しました: ${rel}`);
      const next = range
        ? `${current.slice(0, range.start)}${block}${current.slice(range.end)}`
        : rel === ".gitignore"
          ? `${block}${newline}${current ? newline : ""}${current}`
          : `${current}${current && !current.endsWith("\n") ? newline : ""}${current ? newline : ""}${block}${newline}`;
      baseline.rootContributions[rel] = { ...contribution, marker: identity, hash: digest(block) };
      put(rel, Buffer.from(next));
    } else if (contribution.policy === "json-array" || contribution.policy === "json-map") {
      const next = mergeJson(
        currentBytes?.toString("utf8") ?? "",
        incoming.toString("utf8"),
        contribution,
        rel,
        sameContribution ? previous : undefined,
      );
      baseline.rootContributions[rel] = { ...contribution, entries: next.entries };
      put(rel, next.text ? Buffer.from(next.text) : currentBytes);
    } else if (contribution.policy === "whole-file") {
      if (digest(incoming) !== contribution.hash)
        throw new Error(`共有設定の内容がマニフェストと一致しません: ${rel}`);
      if (
        currentBytes !== null &&
        !currentBytes.equals(incoming) &&
        (!sameContribution || previous?.hash !== digest(currentBytes))
      )
        throw new Error(`既存のファイルと競合しています。内容を保持しました: ${rel}`);
      put(rel, incoming);
      owned[rel] = digest(incoming);
    } else {
      throw new Error(`共有ファイルの設定方式を確認できません: ${rel}`);
    }
  }
  // Only remove retired files whose exact bytes this installer previously wrote.
  for (const rel of new Set([...Object.keys(prior?.files ?? {}), ...Object.keys(replayed)])) {
    if (Object.hasOwn(owned, rel) || changes.has(rel) || rel === baselineRel) continue;
    const before = read(root, rel);
    if (before === null) continue;
    if (digest(before) !== prior?.files[rel] && digest(before) !== replayed[rel])
      throw new Error(`削除予定の旧設定が編集されています: ${rel}`);
    if (
      rel.startsWith("aidlc/") ||
      ![...allowed].some((prefix) => prefix !== "aidlc" && rel.startsWith(`${prefix}/`))
    )
      throw new Error(`旧設定の削除対象を確認できません: ${rel}`);
    changes.set(rel, {
      rel,
      before,
      after: null,
      mode: lstatSync(safePath(root, rel)).mode & 0o777,
    });
  }
  const baselineBytes = Buffer.from(`${JSON.stringify(baseline, null, 2)}\n`);
  keepOrWrite(baselineRel, baselineBytes, 0o644);
  const receipt: GuideInstall = { schemaVersion: 1, harness, version, files: owned };
  put(guideRel, Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`));
  const list = [...changes.values()].sort((a, b) => a.rel.localeCompare(b.rel));
  // Includes managed files with identical bytes; shared method seeds always remain user-owned.
  const planToken = digest(
    JSON.stringify({
      root,
      harness,
      version,
      files: list.map((change) => [
        change.rel,
        change.before === null ? null : digest(change.before),
        change.after === null ? null : digest(change.after),
        change.mode,
      ]),
    }),
  );
  return { planToken, root, changes: list };
}

export async function planHarnessCandidate(
  candidate: string,
  root: string,
  harness: HarnessId,
  version: string,
  options: Pick<HarnessMergeOptions, "priorCandidate"> = {},
): Promise<{ planToken: string }> {
  return {
    planToken: buildPlan(candidate, root, harness, version, options.priorCandidate).planToken,
  };
}

function checkCurrent(options: HarnessMergeOptions): void {
  options.signal?.throwIfAborted();
  if (options.isCurrent?.() === false) throw new Error("プロジェクトの設定を中止しました。");
}

function equal(a: Buffer | null, b: Buffer | null): boolean {
  return a === null ? b === null : b !== null && a.equals(b);
}

/** Commit one tool as a transaction, retaining already committed tools on later failure. */
export async function applyHarnessCandidate(
  candidate: string,
  root: string,
  harness: HarnessId,
  version: string,
  options: HarnessMergeOptions = {},
): Promise<void> {
  checkCurrent(options);
  const plan = buildPlan(candidate, root, harness, version, options.priorCandidate);
  if (options.planToken !== undefined && options.planToken !== plan.planToken)
    throw new Error("設定計画の確認後にファイルが変更されました。再実行してください。");
  let releaseWorkspace: ((primary?: { error: unknown }) => void) | undefined;
  let failure: { error: unknown } | undefined;
  const committed: Change[] = [];
  const directories: string[] = [];
  const makeParents = (rel: string) => {
    const parts = rel.split("/").slice(0, -1);
    let current = plan.root;
    for (const part of parts) {
      current = path.join(current, part);
      try {
        mkdirSync(current);
        directories.push(current);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
  };
  const replace = (rel: string, bytes: Buffer, mode: number, createOnly = false) => {
    const file = safePath(plan.root, rel);
    const temporary = `${file}.aidlc-guide-${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, bytes, { flag: "wx", mode });
      // A hard link publishes complete bytes without overwriting a concurrent creation.
      if (createOnly) linkSync(temporary, file);
      else renameSync(temporary, file);
    } finally {
      try {
        unlinkSync(temporary);
      } catch {
        // A rename already removed it. Preserve any primary failure if cleanup also fails.
      }
    }
  };
  try {
    releaseWorkspace = await acquireNativeWorkspaceLock(plan.root, options);
    await options.validateLocked?.();
    checkCurrent(options);
    for (const change of plan.changes)
      if (!equal(read(plan.root, change.rel), change.before))
        throw new Error(`設定確認後にファイルが変更されました: ${change.rel}`);
    options.onApplyStart?.();
    for (const change of plan.changes) {
      checkCurrent(options);
      if (equal(change.before, change.after)) continue;
      if (!equal(read(plan.root, change.rel), change.before))
        throw new Error(`設定中にファイルが変更されました: ${change.rel}`);
      makeParents(change.rel);
      if (change.after === null) unlinkSync(safePath(plan.root, change.rel));
      else replace(change.rel, change.after, change.mode, change.before === null);
      committed.push(change);
    }
    checkCurrent(options);
  } catch (error) {
    const recoveryErrors: string[] = [];
    for (const change of committed.reverse()) {
      try {
        if (!equal(read(plan.root, change.rel), change.after))
          throw new Error(`別の変更があるため復元できません: ${change.rel}`);
        if (change.before === null) unlinkSync(safePath(plan.root, change.rel));
        else replace(change.rel, change.before, change.mode);
      } catch (cause) {
        recoveryErrors.push(String(cause));
      }
    }
    for (const directory of directories.reverse()) {
      try {
        rmdirSync(directory);
      } catch {
        /* Never remove nonempty directories. */
      }
    }
    failure = {
      error: recoveryErrors.length
        ? new Error(`${String(error)}\n復元結果: ${recoveryErrors.join("\n")}`, { cause: error })
        : error,
    };
    throw failure.error;
  } finally {
    // A live owner cannot be reaped. Release only the generation acquired above.
    releaseWorkspace?.(failure);
  }
}
