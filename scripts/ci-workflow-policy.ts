/**
 * Repository-specific GitHub Actions rules that actionlint cannot know.
 * Each check takes parsed workflow objects and returns human-readable
 * violations; `lint-workflows.ts` runs them in the single quality gate.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DOCTOR_FIXTURES, DOCTOR_REGISTRY } from "./doctor-evidence.ts";
import { HARNESSES } from "./sync-workflows-shell.ts";

export type Workflow = Record<string, unknown>;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const LEVEL = { none: 0, read: 1, write: 2 } as const;
type Level = keyof typeof LEVEL;

/** A `permissions:` value, or `undefined` when it falls back to the repository default. */
type Grant = { all: Level; scopes: Record<string, Level> } | undefined;

function grantOf(value: unknown): Grant {
  if (value === undefined) return undefined;
  if (value === "read-all") return { all: "read", scopes: {} };
  if (value === "write-all") return { all: "write", scopes: {} };
  const scopes: Record<string, Level> = {};
  for (const [scope, level] of Object.entries(record(value))) {
    if (level === "read" || level === "write" || level === "none") scopes[scope] = level;
  }
  // Any explicit map sets every scope it does not name to none.
  return { all: "none", scopes };
}

const levelIn = (grant: NonNullable<Grant>, scope: string): Level =>
  grant.scopes[scope] ?? grant.all;

/**
 * Find jobs in a called (reusable) workflow that request more token scope
 * than the calling job grants. GitHub validates this before any job starts,
 * whether or not the job would run, and fails the whole caller with
 * `startup_failure`. Callers left on the repository default are skipped
 * because their ceiling is a repository setting, not a file.
 */
export function permissionEscalations(workflows: Map<string, Workflow>): string[] {
  const found: string[] = [];
  for (const [file, workflow] of workflows) {
    for (const [jobId, rawJob] of Object.entries(record(workflow.jobs))) {
      const job = record(rawJob);
      const target = typeof job.uses === "string" ? job.uses : "";
      const local = /^\.\/\.github\/workflows\/([^/@]+)$/.exec(target)?.[1];
      if (local === undefined) continue;
      const called = workflows.get(local);
      const ceiling = grantOf(job.permissions ?? workflow.permissions);
      if (called === undefined || ceiling === undefined) continue;
      for (const [nestedId, rawNested] of Object.entries(record(called.jobs))) {
        // A nested job without any declaration inherits the caller's grant.
        const requested = grantOf(record(rawNested).permissions ?? called.permissions);
        if (requested === undefined) continue;
        const scopes = new Set([...Object.keys(requested.scopes), ...Object.keys(ceiling.scopes)]);
        for (const scope of [...scopes].sort()) {
          const want = levelIn(requested, scope);
          const have = levelIn(ceiling, scope);
          if (LEVEL[want] > LEVEL[have]) {
            found.push(
              `${file}: job ${jobId} calls ${local}, whose job ${nestedId} requests ${scope}: ${want} but the caller grants ${scope}: ${have}`,
            );
          }
        }
      }
    }
  }
  return found;
}

/** Status-check names a job reports: its name, or `name (matrix values)` per matrix leg. */
function producesCheck(jobId: string, rawJob: unknown, contexts: readonly string[]): boolean {
  const job = record(rawJob);
  const name = typeof job.name === "string" ? job.name : jobId;
  return contexts.some((context) => context === name || context.startsWith(`${name} (`));
}

function pushReachesMain(on: unknown): boolean {
  if (on === "push") return true;
  if (Array.isArray(on)) return on.includes("push");
  const triggers = record(on);
  if (!Object.hasOwn(triggers, "push")) return false;
  const push = record(triggers.push);
  const branches = push.branches;
  if (!Array.isArray(branches)) return !Array.isArray(push["branches-ignore"]);
  return branches.some((branch) => branch === "main" || branch === "**" || branch === "*");
}

/**
 * Find workflows that report a required status check and also run on push to
 * main. With `strict_required_status_checks_policy`, a pull request must be up
 * to date before it merges, so the squash commit's tree is the one its checks
 * already passed; the push run repeats them for nothing.
 */
export function duplicatePushRuns(
  workflows: Map<string, Workflow>,
  requiredContexts: readonly string[],
  strict: boolean,
): string[] {
  if (!strict) return [];
  const found: string[] = [];
  for (const [file, workflow] of workflows) {
    const required = Object.entries(record(workflow.jobs)).some(([id, job]) =>
      producesCheck(id, job, requiredContexts),
    );
    if (required && pushReachesMain(workflow.on)) {
      found.push(
        `${file}: produces required checks but also runs on push to main; with up-to-date branches required, that push re-tests the tree its pull request already passed`,
      );
    }
  }
  return found;
}

const SOURCE = /\.(?:[cm]?ts|tsx|[cm]?js|json)$/;
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;

function workspacePackages(root: string): Map<string, string> {
  const packages = new Map<string, string>();
  const dir = path.join(root, "packages");
  if (!existsSync(dir)) return packages;
  for (const entry of readdirSync(dir)) {
    const manifest = path.join(dir, entry, "package.json");
    if (!existsSync(manifest)) continue;
    const parsed = record(JSON.parse(readFileSync(manifest, "utf8")));
    const exports = parsed.exports;
    const main =
      typeof exports === "string"
        ? exports
        : typeof record(exports)["."] === "string"
          ? (record(exports)["."] as string)
          : typeof parsed.main === "string"
            ? parsed.main
            : undefined;
    if (typeof parsed.name === "string" && main !== undefined) {
      packages.set(parsed.name, path.join(dir, entry, main));
    }
  }
  return packages;
}

function resolveFile(candidate: string): string | undefined {
  for (const file of [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}/index.ts`]) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return undefined;
}

/** Repository files reachable from the entry scripts through relative and workspace imports. */
function importClosure(root: string, entries: string[]): string[] {
  const packages = workspacePackages(root);
  const seen = new Set<string>();
  const queue = entries.map((entry) => path.join(root, entry));
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.(?:[cm]?ts|tsx|[cm]?js)$/.test(file)) continue;
    for (const match of readFileSync(file, "utf8").matchAll(IMPORT)) {
      const specifier = match[1] as string;
      const target = specifier.startsWith(".")
        ? resolveFile(path.resolve(path.dirname(file), specifier))
        : packages.has(specifier)
          ? resolveFile(packages.get(specifier) as string)
          : undefined;
      if (target !== undefined && SOURCE.test(target)) queue.push(target);
    }
  }
  return [...seen].map((file) => path.relative(root, file).split(path.sep).join("/"));
}

/**
 * Files doctor-contract opens by path rather than by import: the pinned
 * release and its runtime (manifest, package.json, lockfile), the recorded
 * evidence the captures are compared with, the bundled shells and their
 * override hashes, and the workflow and line-ending rules themselves.
 */
export const DOCTOR_DATA_INPUTS: readonly string[] = [
  ".github/workflows/doctor-contract.yml",
  ".gitattributes",
  "package.json",
  "bun.lock",
  "docs/official-docs.manifest.json",
  "scripts/workflows-shell-overrides.json",
  DOCTOR_REGISTRY,
  `${DOCTOR_FIXTURES}/`,
  ...HARNESSES.map((harness) => `${harness.localRel}/`),
];

const covered = (inputs: readonly string[], file: string) =>
  inputs.some((input) => (input.endsWith("/") ? file.startsWith(input) : file === input));

/**
 * Compare doctor-contract's change scope with what its steps actually read.
 * The scope list lives in the `scope` job's `DOCTOR_INPUTS` env (one path per
 * line; a trailing slash means a directory). Entry scripts are the
 * `bun scripts/*.ts` commands in the `doctor-contract` job (outside steps with
 * their own working directory), followed through
 * their imports; `dataInputs` are files the scripts open by path. Returns the
 * uncovered paths, sorted, so a new import cannot silently skip the contract.
 */
export function doctorScopeGaps(
  root: string,
  workflow: Workflow,
  dataInputs: readonly string[],
): string[] {
  const jobs = record(workflow.jobs);
  const scopeSteps = record(jobs.scope).steps;
  const list = (Array.isArray(scopeSteps) ? scopeSteps : [])
    .map((step) => record(record(step).env).DOCTOR_INPUTS)
    .find((value): value is string => typeof value === "string");
  if (list === undefined) throw new Error("doctor-contract: scope job has no DOCTOR_INPUTS list");
  const inputs = list
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const steps = record(jobs["doctor-contract"]).steps;
  const entries = new Set<string>();
  for (const step of Array.isArray(steps) ? steps : []) {
    const run = record(step).run;
    // A step with its own working directory runs another checkout's scripts.
    if (typeof run !== "string" || record(step)["working-directory"] !== undefined) continue;
    for (const match of run.matchAll(/\bbun\s+(scripts\/[\w.-]+\.ts)\b/g)) {
      entries.add(match[1] as string);
    }
  }
  const required = [...importClosure(root, [...entries]), ...dataInputs];
  return [...new Set(required.filter((file) => !covered(inputs, file)))].sort();
}
