import { createHash } from "node:crypto";
import { type BigIntStats, constants } from "node:fs";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import path from "node:path";

/**
 * Read-only projection of aidlc-workflows v2.8.2 (355903d), core/tools/aidlc-lib.ts:
 * reviewArtifactContentsFingerprint, workspaceSourceState and unitSourceFingerprint.
 * Never imports or executes an installed engine. Unknown inputs fail closed.
 */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const HASH = /^sha256:[0-9a-f]{64}$/;
const MAX_FILE = 10 * 1024 * 1024;
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_ENTRIES = 10_000;
const HARD = new Set([
  ".cache",
  ".git",
  ".gradle",
  ".mypy_cache",
  ".next",
  ".nuxt",
  ".pytest_cache",
  ".ruff_cache",
  ".tox",
  ".venv",
  "node_modules",
  "venv",
]);
const GENERATED = new Set(["build", "coverage", "dist", "logs", "target", "tmp"]);
const KINDS = new Set(["service", "spec", "ui", "packaging", "library"]);
const FILENAMES: Readonly<Record<string, string>> = {
  "build-test-results": "test-results.md",
  "load-test-results": "test-results.md",
  traceability: "traceability.json",
};
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const segment = (value: unknown): value is string =>
  typeof value === "string" && SEGMENT.test(value);
const inside = (root: string, file: string) => {
  const relative = path.relative(root, file);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`))
  );
};
const same = (a: BigIntStats, b: BigIntStats) =>
  a.dev === b.dev &&
  a.ino === b.ino &&
  a.mode === b.mode &&
  a.nlink === b.nlink &&
  a.size === b.size &&
  a.mtimeNs === b.mtimeNs &&
  a.ctimeNs === b.ctimeNs;

/** A per-build IO budget and identity check, with no file bodies retained. */
class Snapshot {
  private bytes = 0;
  private entries = 0;
  private identities = new Map<string, BigIntStats | null>();
  constructor(readonly root: string) {}

  async inspect(relative: string): Promise<BigIntStats | "missing" | null> {
    const target = path.resolve(this.root, relative);
    if (!inside(this.root, target)) return null;
    let cursor = this.root;
    try {
      for (const part of path.relative(this.root, target).split(path.sep).filter(Boolean)) {
        cursor = path.join(cursor, part);
        const stat = await lstat(cursor, { bigint: true });
        if (stat.isSymbolicLink()) return null;
        const previous = this.identities.get(cursor);
        if (previous !== undefined && (previous === null || !same(previous, stat))) return null;
        this.identities.set(cursor, stat);
      }
      if (!inside(this.root, await realpath(target))) return null;
      const stat = await lstat(target, { bigint: true });
      const previous = this.identities.get(target);
      if (previous !== undefined && (previous === null || !same(previous, stat))) return null;
      this.identities.set(target, stat);
      return stat;
    } catch (error) {
      if ((error as { code?: string }).code !== "ENOENT") return null;
      if (this.identities.get(cursor)) return null;
      this.identities.set(cursor, null);
      return "missing";
    }
  }

  async read(relative: string, max = MAX_FILE): Promise<Buffer | "missing" | "not-file" | null> {
    const before = await this.inspect(relative);
    if (before === null || before === "missing") return before;
    if (!before.isFile()) return "not-file";
    if (before.nlink !== 1n || before.size > BigInt(max)) return null;
    this.bytes += Number(before.size);
    if (this.bytes > MAX_BYTES) return null;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(
        path.join(this.root, relative),
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
      );
      if (!same(before, await handle.stat({ bigint: true }))) return null;
      const buffer = Buffer.alloc(Number(before.size) + 1);
      let count = 0;
      while (count < buffer.length) {
        const read = await handle.read(buffer, count, buffer.length - count, count);
        if (read.bytesRead === 0) break;
        count += read.bytesRead;
      }
      if (count !== Number(before.size) || !same(before, await handle.stat({ bigint: true })))
        return null;
      return buffer.subarray(0, count);
    } catch {
      return null;
    } finally {
      await handle?.close().catch(() => {});
    }
  }

  async list(relative: string): Promise<string[] | null> {
    const stat = await this.inspect(relative);
    if (stat === null || stat === "missing" || !stat.isDirectory()) return null;
    try {
      const names: string[] = [];
      const dir = await opendir(path.join(this.root, relative));
      for await (const entry of dir) {
        if (++this.entries > MAX_ENTRIES) return null;
        names.push(entry.name);
      }
      return names.sort();
    } catch {
      return null;
    }
  }

  async stable(): Promise<boolean> {
    for (const [file, before] of this.identities) {
      try {
        const after = await lstat(file, { bigint: true });
        if (before === null || !same(before, after)) return false;
      } catch (error) {
        if (before !== null || (error as { code?: string }).code !== "ENOENT") return false;
      }
    }
    return true;
  }
}

async function json(snapshot: Snapshot, relative: string): Promise<unknown> {
  const bytes = await snapshot.read(relative);
  if (bytes === "missing") return undefined;
  if (!Buffer.isBuffer(bytes)) return null;
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    return null;
  }
}

export interface ReviewArtifactStage {
  slug: string;
  phase: string;
  for_each?: string;
  produces: string[];
  optional_produces?: string[];
  produces_kinds?: Record<string, string[]>;
  review_artifact: string;
  workspace_requires?: boolean;
}

function stageDefinition(value: unknown): ReviewArtifactStage | null {
  if (
    !object(value) ||
    !segment(value.slug) ||
    !segment(value.phase) ||
    !segment(value.review_artifact)
  )
    return null;
  for (const field of ["produces", "optional_produces"]) {
    const names = value[field];
    if (names === undefined && field === "optional_produces") continue;
    if (!Array.isArray(names) || !names.every(segment) || new Set(names).size !== names.length)
      return null;
  }
  if (!(value.produces as string[]).includes(value.review_artifact)) return null;
  if (
    value.produces_kinds !== undefined &&
    (!object(value.produces_kinds) ||
      !Object.entries(value.produces_kinds).every(
        ([name, kinds]) =>
          segment(name) &&
          Array.isArray(kinds) &&
          kinds.every((kind) => typeof kind === "string" && KINDS.has(kind)),
      ))
  )
    return null;
  if (value.workspace_requires !== undefined && typeof value.workspace_requires !== "boolean")
    return null;
  return {
    slug: value.slug,
    phase: value.phase,
    review_artifact: value.review_artifact,
    produces: value.produces as string[],
    ...(value.for_each === undefined ? {} : { for_each: String(value.for_each) }),
    ...(value.optional_produces === undefined
      ? {}
      : { optional_produces: value.optional_produces as string[] }),
    ...(value.produces_kinds === undefined
      ? {}
      : { produces_kinds: value.produces_kinds as Record<string, string[]> }),
    ...(value.workspace_requires === undefined
      ? {}
      : { workspace_requires: value.workspace_requires as boolean }),
  };
}

async function artifacts(
  snapshot: Snapshot,
  record: string,
  stage: ReviewArtifactStage,
  unit: string,
  kind: string | null,
): Promise<string | null> {
  if (!segment(unit) || stage.for_each !== "unit-of-work" || stage.phase !== "construction")
    return null;
  const names = [...stage.produces, ...(stage.optional_produces ?? [])].filter(
    (name) =>
      kind === null ||
      stage.produces_kinds?.[name] === undefined ||
      stage.produces_kinds[name]?.includes(kind),
  );
  const entries = names
    .map((name) => ({
      name,
      logical: `construction/${unit}/${stage.slug}/${FILENAMES[name] ?? `${name}.md`}`,
    }))
    .sort((a, b) => a.logical.localeCompare(b.logical));
  const manifest: [string, string][] = [];
  let targetFound = false;
  for (const entry of entries) {
    const bytes = await snapshot.read(record ? `${record}/${entry.logical}` : entry.logical);
    if (bytes === null) return null;
    if (entry.name === stage.review_artifact && Buffer.isBuffer(bytes)) targetFound = true;
    manifest.push([entry.logical, Buffer.isBuffer(bytes) ? `sha256:${hash(bytes)}` : bytes]);
  }
  return targetFound ? `sha256:${hash(JSON.stringify(manifest))}` : null;
}

/** Useful independently for callers that already resolved a stage and unit kind. */
export async function currentReviewArtifactFingerprint(
  recordDir: string,
  definition: ReviewArtifactStage,
  unit: string,
  kind: string | null = null,
): Promise<string | null> {
  const stage = stageDefinition(definition);
  if (stage === null || (kind !== null && !KINDS.has(kind))) return null;
  try {
    const snapshot = new Snapshot(await realpath(recordDir));
    const result = await artifacts(snapshot, "", stage, unit, kind);
    return (await snapshot.stable()) ? result : null;
  } catch {
    return null;
  }
}

function visibleLines(text: string): string[] | null {
  let fence: { character: string; length: number } | null = null;
  let comment = false;
  let ambiguous = false;
  const result = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      if (fence) {
        const closing = /^ {0,3}(`+|~+)\s*$/.exec(line)?.[1];
        if (closing?.[0] === fence.character && closing.length >= fence.length) fence = null;
        return "";
      }
      if (!comment) {
        const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
        if (opening) {
          fence = { character: opening[0] as string, length: opening.length };
          return "";
        }
        if (/^(?: {4}|\t)/.test(line)) return "";
      }
      let visible = "";
      let offset = 0;
      while (offset < line.length) {
        if (comment) {
          const end = line.indexOf("-->", offset);
          if (end < 0) break;
          comment = false;
          offset = end + 3;
        } else {
          const start = line.indexOf("<!--", offset);
          const tick = line.indexOf("`", offset);
          if (tick >= 0 && (start < 0 || tick < start)) {
            visible += line.slice(offset, tick);
            const delimiter = /^`+/.exec(line.slice(tick))?.[0] as string;
            const rest = line.slice(tick + delimiter.length);
            const closing = [...rest.matchAll(/`+/g)].find(
              (match) => match[0].length === delimiter.length,
            );
            // Multiline code spans need a full Markdown parser. Never let an
            // uncertain literal context weaken a governing strict declaration.
            if (closing === undefined) {
              ambiguous = true;
              return "";
            }
            offset = tick + delimiter.length + closing.index + delimiter.length;
            visible += " ";
            continue;
          }
          if (start < 0) {
            visible += line.slice(offset);
            break;
          }
          visible += line.slice(offset, start);
          comment = true;
          offset = start + 4;
        }
      }
      return visible;
    });
  return ambiguous ? null : result;
}

async function mode(
  snapshot: Snapshot,
  record: string,
  memory: string,
): Promise<"strict" | "relaxed" | null> {
  const state = await snapshot.read(`${record}/aidlc-state.md`);
  if (!Buffer.isBuffer(state)) return null;
  // State fields use the engine's raw getField grammar, unlike memory sections:
  // exactly "- **Field**:" at column zero, including lines inside fences.
  const declarations = [
    ...state.toString("utf8").matchAll(/^- \*\*Change Control\*\*:[ \t]*(.*)$/gm),
  ];
  if (declarations.length > 1) return null;
  const raw = declarations[0]?.[1]?.trim();
  const match = raw === undefined ? null : /^(strict|relaxed)(?:\s*\([^\r\n]*\))?$/i.exec(raw);
  if (raw !== undefined && !match) return null;
  let value: "strict" | "relaxed" = match?.[1]?.toLowerCase() === "relaxed" ? "relaxed" : "strict";
  for (const layer of ["org", "team", "project"]) {
    const bytes = await snapshot.read(`${memory}/${layer}.md`);
    if (bytes === "missing") continue;
    if (!Buffer.isBuffer(bytes)) return null;
    const lines = visibleLines(bytes.toString("utf8"));
    if (lines === null) return null;
    if (lines.filter((line) => line.trimEnd() === "## Change Control").length > 1) return null;
    const start = lines.findIndex((line) => line.trimEnd() === "## Change Control");
    if (start < 0) continue;
    const end = lines.findIndex((line, index) => index > start && /^## /.test(line));
    const section = lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
    const settings = [
      ...section.matchAll(
        /^[ \t]*(?:[-*][ \t]*)?(?:\*\*)?Mode(?:\*\*)?[ \t]*:[ \t]*(.+?)[ \t]*$/gim,
      ),
    ];
    if (settings.length > 1) return null;
    const setting = settings[0]?.[1];
    if (setting === undefined) continue;
    const parsed = setting.toLowerCase().replace(/[`*_]/g, "").trim();
    if (parsed !== "strict" && parsed !== "relaxed") return null;
    if (parsed === "strict") value = "strict";
  }
  return value;
}

// No process-wide cache: every matrix build observes fresh metadata and bytes.
export async function createReviewFreshnessReader(
  recordDir: string,
): Promise<(fields: Readonly<Record<string, string>>) => Promise<boolean>> {
  const deny = async () => false;
  const resolved = path.resolve(recordDir);
  const parts = resolved.split(path.sep);
  const marker = parts.length - 5;
  if (
    parts[marker] !== "aidlc" ||
    parts[marker + 1] !== "spaces" ||
    parts[marker + 3] !== "intents"
  )
    return deny;
  if (!segment(parts[marker + 2]) || !segment(parts[marker + 4])) return deny;
  const project = parts.slice(0, marker).join(path.sep) || path.parse(resolved).root;
  try {
    const root = await realpath(project);
    const snapshot = new Snapshot(root);
    const record = path.relative(project, resolved).split(path.sep).join("/");
    const space = `aidlc/spaces/${parts[marker + 2]}`;
    const control = await mode(snapshot, record, `${space}/memory`);
    if (control === null) return deny;
    if (control === "relaxed") return async () => snapshot.stable();
    const definitions = loadDefinitions(snapshot);
    const unitKinds = loadUnitKinds(snapshot, record);
    let source: Promise<SourceState | null> | undefined;
    return async (fields) => {
      const unit = fields.Unit;
      const slug = fields.Stage;
      if (!segment(unit) || !segment(slug) || !HASH.test(fields["Artifact Fingerprint"] ?? ""))
        return false;
      const graph = await definitions;
      const stage = graph?.get(slug);
      if (!stage) return false;
      const kinds = await unitKinds;
      if (kinds === null && stage.produces_kinds !== undefined) return false;
      const current = await artifacts(snapshot, record, stage, unit, kinds?.get(unit) ?? null);
      if (current === null || current !== fields["Artifact Fingerprint"]) return false;
      if (
        stage.workspace_requires ||
        fields["Source Fingerprint"] ||
        fields["Unit Source Fingerprint"]
      ) {
        source ??= workspaceSource(snapshot, space, parts[marker + 4] as string);
        const currentSource = await source;
        if (currentSource === null || currentSource.fingerprint !== fields["Source Fingerprint"])
          return false;
        const unitFingerprint = await unitSource(snapshot, record, stage.slug, unit, currentSource);
        if (unitFingerprint === null || unitFingerprint !== fields["Unit Source Fingerprint"])
          return false;
      }
      return snapshot.stable();
    };
  } catch {
    return deny;
  }
}

async function loadDefinitions(
  snapshot: Snapshot,
): Promise<Map<string, ReviewArtifactStage> | null> {
  const names = await snapshot.list("");
  if (names === null) return null;
  const graph = new Map<string, ReviewArtifactStage>();
  for (const name of names.filter(
    (name) => !HARD.has(name) && /^\.[a-z0-9][a-z0-9._-]*$/i.test(name),
  )) {
    const info = await snapshot.inspect(name);
    if (info === null || info === "missing") return null;
    if (!info.isDirectory()) continue;
    const raw = await json(snapshot, `${name}/tools/data/stage-graph.json`);
    if (raw === undefined) continue;
    if (!Array.isArray(raw)) return null;
    for (const value of raw) {
      if (!object(value) || value.phase !== "construction" || value.review_artifact === undefined)
        continue;
      const stage = stageDefinition(value);
      if (stage === null) return null;
      const prior = graph.get(stage.slug);
      if (prior && JSON.stringify(prior) !== JSON.stringify(stage)) return null;
      graph.set(stage.slug, stage);
    }
  }
  return graph;
}

/** Restrict authored YAML to the ordinary form; unfamiliar syntax is unknown. */
// v2.8.2 unquoteScalar removes matching outer quotes without YAML unescaping.
// Validate the resulting names/kinds below before using them.
function unitScalar(raw: string): string {
  const value = raw.trim();
  return /^("[\s\S]*"|'[\s\S]*')$/.test(value) ? value.slice(1, -1) : value;
}

async function loadUnitKinds(
  snapshot: Snapshot,
  record: string,
): Promise<Map<string, string> | null> {
  const bytes = await snapshot.read(
    `${record}/inception/units-generation/unit-of-work-dependency.md`,
  );
  if (bytes === "missing") {
    const runtime = await json(snapshot, `${record}/runtime-graph.json`);
    if (runtime === undefined) return new Map();
    if (!object(runtime)) return null;
    if (runtime.bolt_dag === undefined) return new Map();
    if (
      !object(runtime.bolt_dag) ||
      !Array.isArray(runtime.bolt_dag.units) ||
      !Array.isArray(runtime.bolt_dag.batches)
    )
      return null;
    const names = runtime.bolt_dag.batches.flat();
    if (!names.every(segment) || new Set(names).size !== names.length) return null;
    const kinds = new Map<string, string>();
    for (const row of runtime.bolt_dag.units) {
      if (!object(row) || !segment(row.name) || !names.includes(row.name)) return null;
      if (row.kind !== undefined) {
        if (typeof row.kind !== "string" || !KINDS.has(row.kind) || kinds.has(row.name))
          return null;
        kinds.set(row.name, row.kind);
      }
    }
    return kinds;
  }
  if (!Buffer.isBuffer(bytes)) return null;
  const blocks = [
    ...bytes.toString("utf8").matchAll(/^[ \t]*```ya?ml\s*\r?\n([\s\S]*?)^[ \t]*```\s*$/gm),
  ];
  const block = blocks.find((match) => /^\s*units\s*:/m.test(match[1] ?? ""))?.[1];
  if (block === undefined) return null;
  const rows = new Map<string, { kind?: string; deps: string[] }>();
  let row: { kind?: string; deps: string[] } | undefined;
  let started = false;
  for (const line of block.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!started && /^\s*units\s*:\s*$/.test(line)) {
      started = true;
      continue;
    }
    if (!started) continue;
    const rawName = /^\s*-\s+name\s*:\s*(.+?)\s*$/.exec(line)?.[1];
    if (rawName !== undefined) {
      const name = unitScalar(rawName);
      if (!segment(name) || rows.has(name)) return null;
      row = { deps: [] };
      rows.set(name, row);
      continue;
    }
    if (!row) return null;
    const rawKind = /^\s*kind\s*:\s*(.+?)\s*$/.exec(line)?.[1];
    if (rawKind !== undefined) {
      const kind = unitScalar(rawKind);
      if (!KINDS.has(kind)) return null;
      row.kind = kind;
      continue;
    }
    const deps = /^\s*depends_on\s*:\s*(.*)$/.exec(line)?.[1];
    if (deps !== undefined) {
      const value = deps.trim();
      const inline = /^\[([^\]]*)\][ \t]*(?:#[^\r\n]*)?$/.exec(value);
      if (value.startsWith("[") && !inline) return null;
      // Valid unit names cannot contain commas, brackets or quotes, so splitting
      // before unquoting is sufficient; malformed items remain invalid below.
      row.deps = inline
        ? (inline[1] ?? "").split(",").map(unitScalar).filter(Boolean)
        : value === ""
          ? []
          : [unitScalar(value)];
      if (!row.deps.every(segment)) return null;
      continue;
    }
    const rawDep = /^\s*-\s+(.+?)\s*$/.exec(line)?.[1];
    if (rawDep !== undefined) {
      const dep = unitScalar(rawDep);
      if (!segment(dep)) return null;
      row.deps.push(dep);
      continue;
    }
    return null;
  }
  const pending = new Set(rows.keys());
  if (
    pending.size === 0 ||
    [...rows.values()].some((entry) => entry.deps.some((dep) => !rows.has(dep)))
  )
    return null;
  while (pending.size) {
    const ready = [...pending].filter((name) =>
      rows.get(name)?.deps.every((dep) => !pending.has(dep)),
    );
    if (!ready.length) return null;
    for (const name of ready) pending.delete(name);
  }
  return new Map([...rows].flatMap(([name, entry]) => (entry.kind ? [[name, entry.kind]] : [])));
}

type SourceState = { fingerprint: string; listing: Map<string, string>; shell: Set<string> };
function sensorCache(relative: string): boolean {
  return /(?:^|\/)aidlc\/spaces\/[^/]+\/intents\/.+\/\.aidlc-sensors(?:\/|$)/.test(relative);
}

/** Single-repository filesystem identity; complex source boundaries are unknown. */
async function workspaceSource(
  snapshot: Snapshot,
  space: string,
  intent: string,
): Promise<SourceState | null> {
  const registry = await json(snapshot, `${space}/intents/intents.json`);
  if (registry !== undefined) {
    if (!Array.isArray(registry)) return null;
    // Any repo mapping needs the multi-repository roof rules, not a single-root walk.
    for (const row of registry) {
      if (!object(row)) return null;
      const matches =
        row.dirName === intent ||
        (typeof row.slug === "string" && intent.startsWith(`${row.slug}-`));
      if (matches && row.repos !== undefined && (!Array.isArray(row.repos) || row.repos.length > 0))
        return null;
    }
  }
  if ((await snapshot.inspect(".aidlc/worktree-meta.json")) !== "missing") return null;
  const roots = await snapshot.list("");
  if (roots === null) return null;
  const shell = new Set(["aidlc", ".aidlc"]);
  for (const name of roots.filter(
    (name) => !HARD.has(name) && /^\.[a-z0-9][a-z0-9._-]*$/i.test(name),
  )) {
    const info = await snapshot.inspect(name);
    if (info === null || info === "missing") return null;
    if (!info.isDirectory()) continue;
    const manifest = await json(snapshot, `${name}/tools/data/harness.json`);
    if (object(manifest) && typeof manifest.name === "string" && manifest.name.trim())
      shell.add(name);
  }
  // Registered generated paths and symlink targets require the full engine walker.
  if ((await snapshot.inspect(".aidlc-source-paths.json")) !== "missing") return null;
  const lines: string[] = [];
  const listing = new Map<string, string>();
  async function walk(relative: string, depth: number): Promise<boolean> {
    if (depth > 64) return false;
    const names = await snapshot.list(relative);
    if (names === null) return false;
    for (const name of names) {
      const rel = relative ? `${relative}/${name}` : name;
      if (name === ".git" || sensorCache(rel)) continue;
      // Excluded roots are not traversed, even when installed as symlinks.
      if (!relative && shell.has(name)) continue;
      if (HARD.has(name) || GENERATED.has(name)) {
        const info = await lstat(path.join(snapshot.root, rel)).catch(() => null);
        if (info === null) return false;
        if (info.isDirectory() || info.isSymbolicLink()) continue;
      }
      const info = await snapshot.inspect(rel);
      if (info === null || info === "missing") return false;
      if (info.isDirectory()) {
        if ((await snapshot.inspect(`${rel}/.git`)) !== "missing" || !(await walk(rel, depth + 1)))
          return false;
      } else if (info.isFile()) {
        const bytes = await snapshot.read(rel);
        if (!Buffer.isBuffer(bytes)) return false;
        const sha = hash(bytes);
        const executable = (info.mode & 0o111n) !== 0n;
        lines.push(`file:${rel}:${executable ? "x" : "-"}=${sha}`);
        listing.set(rel, `${executable ? "100755" : "100644"}\t${sha}`);
      } else return false;
    }
    return true;
  }
  if (!(await walk("", 0))) return null;
  const filesystem = hash(["aidlc-filesystem-source-v2", ...lines].join("\n"));
  return {
    fingerprint: hash(`aidlc-workspace-source-v2\nfilesystem=${filesystem}`),
    listing,
    shell,
  };
}

async function unitSource(
  snapshot: Snapshot,
  record: string,
  stage: string,
  unit: string,
  source: SourceState,
): Promise<string | null> {
  const bytes = await snapshot.read(`${record}/construction/${unit}/${stage}/source-manifest.json`);
  if (!Buffer.isBuffer(bytes)) return null;
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    return null;
  }
  if (
    !object(value) ||
    value.version !== 1 ||
    value.stage !== stage ||
    value.unit !== unit ||
    !Array.isArray(value.writes) ||
    Object.keys(value).some((key) => !["version", "stage", "unit", "writes"].includes(key))
  )
    return null;
  const claims = new Set<string>();
  for (const write of value.writes) {
    if (
      !object(write) ||
      typeof write.path !== "string" ||
      Object.keys(write).some((key) => key !== "path")
    )
      return null;
    const raw = write.path;
    if (
      !raw ||
      /[\\\0*?[\]{}]/.test(raw) ||
      raw.startsWith("/") ||
      /^[A-Za-z]:/.test(raw) ||
      raw.split("/").includes("..")
    )
      return null;
    const parts = raw.split("/").filter((part) => part !== "" && part !== ".");
    if (
      !parts.length ||
      source.shell.has(parts[0] as string) ||
      parts.some((part) => HARD.has(part) || GENERATED.has(part))
    )
      return null;
    const claim = `${parts.join("/")}${raw.endsWith("/") ? "/" : ""}`;
    if (claims.has(claim) || sensorCache(claim)) return null;
    claims.add(claim);
  }
  const escapeField = (value: string) =>
    value
      .replaceAll("\\", "\\\\")
      .replaceAll("\t", "\\t")
      .replaceAll("\n", "\\n")
      .replaceAll("\r", "\\r");
  const lines = [...source.listing]
    .filter(
      ([file]) =>
        claims.has(file) ||
        [...claims].some((claim) => claim.endsWith("/") && file.startsWith(claim)),
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([file, entry]) => `\t${escapeField(file)}\t${entry}\n`)
    .join("");
  return `sha256:${hash(`manifest\t${hash(bytes)}\t-\n${lines}`)}`;
}
