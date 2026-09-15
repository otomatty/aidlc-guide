#!/usr/bin/env bun
/**
 * Launch, doctor, and stop a disposable AIDLC Guide dashboard-server.
 * Invocation is documented in ../SKILL.md. Never attach to a server this
 * process did not start.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(SKILL_DIR, "..", "..", "..");
const RUN_FILE = path.join(SKILL_DIR, ".run.json");
const EVIDENCE_DIR = path.join(SKILL_DIR, "evidence");
const CLI = path.join(REPO_ROOT, "packages", "dashboard-server", "src", "cli.ts");
const DIST_INDEX = path.join(REPO_ROOT, "packages", "dashboard", "dist", "index.html");
const READY = /AIDLC Guide dashboard: http:\/\/([\d.]+):(\d+)/;
const READY_MS = 30_000;
const HEALTH_MS = 8_000;
const BUN = process.platform === "win32" ? "bun.exe" : "bun";

type Command = "launch" | "doctor" | "origin" | "stop";

interface RunRecord {
  id: string;
  pid: number;
  origin: string;
  hostname: string;
  port: number;
  cwd: string;
  startedAt: string;
  evidenceDir: string;
  sourceMtime: number;
  /** OS start identity captured at spawn. Required before any `process.kill(pid)`. */
  processStartKey: string | null;
}

function isCommand(value: string): value is Command {
  return value === "launch" || value === "doctor" || value === "origin" || value === "stop";
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message: string, extra?: Record<string, unknown>): never {
  print({ ok: false, error: message, ...extra });
  process.exit(1);
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stable OS-level identity for `pid`. Origin HTTP is not process identity:
 * another listener can serve the same URL, and Windows can reuse the pid
 * between the alive-check and `process.kill`.
 */
function processStartKey(pid: number): string | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    if (process.platform === "win32") {
      const result = spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`,
        ],
        { encoding: "utf8", timeout: 8000, windowsHide: true },
      );
      const key = result.stdout.trim();
      return result.status === 0 && /^\d+$/.test(key) ? key : null;
    }
    const procStat = `/proc/${pid}/stat`;
    if (existsSync(procStat)) {
      const stat = readFileSync(procStat, "utf8");
      const close = stat.lastIndexOf(")");
      if (close === -1) return null;
      const after = stat.slice(close + 1).trim().split(/\s+/);
      const starttime = after[19];
      return starttime !== undefined && starttime !== "" ? starttime : null;
    }
    const result = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], {
      encoding: "utf8",
      timeout: 5000,
    });
    const key = result.stdout.trim();
    return result.status === 0 && key !== "" ? key : null;
  } catch {
    return null;
  }
}

function sameProcess(pid: number, startKey: string | null | undefined): boolean {
  if (startKey === undefined || startKey === null || startKey === "") return false;
  const live = processStartKey(pid);
  return live !== null && live === startKey;
}

/** Kill only when the recorded pid is still the same OS process. */
function tryKillRecorded(run: Pick<RunRecord, "pid" | "processStartKey">): "killed" | "mismatch" {
  if (!sameProcess(run.pid, run.processStartKey)) return "mismatch";
  try {
    process.kill(run.pid);
    return "killed";
  } catch (error) {
    if (!pidAlive(run.pid)) return "killed";
    fail("failed to kill recorded pid", { pid: run.pid, error: errorMessage(error) });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isWorkflowPayload(body: unknown): boolean {
  if (!isRecord(body) || !isRecord(body.workflow) || !isRecord(body.nextStep)) return false;
  if (!isRecord(body.serverMode) || typeof body.serverMode.hostMode !== "boolean") return false;
  return true;
}

function isTypedWorkflowError(body: unknown): boolean {
  return isRecord(body) && body.error === true && typeof body.reason === "string";
}

function isUnsupportedWorkspace(body: unknown): boolean {
  return (
    isRecord(body) &&
    body.unsupported === true &&
    typeof body.version === "string" &&
    isRecord(body.serverMode) &&
    typeof body.serverMode.hostMode === "boolean"
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function timedGet(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchUrl(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    return await timedGet(url);
  } catch (error) {
    fail("request failed", { url, error: errorMessage(error) });
  }
}

function parseJsonBody(text: string, url: string, status: number): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail("response was not JSON", { url, status, error: errorMessage(error) });
  }
}

async function originLooksLikeDashboard(origin: string): Promise<boolean> {
  try {
    const page = await timedGet(origin);
    return page.ok && page.text.includes('id="root"') && page.text.includes("AIDLC Guide");
  } catch {
    return false;
  }
}

const SERVER_SRC_PACKAGES = [
  "dashboard-server",
  "api-core",
  "reader-core",
  "docs-bridge",
  "official-docs",
  "core-utils",
  "shared-types",
] as const;

async function maxMtime(dir: string): Promise<number> {
  let latest = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      latest = Math.max(latest, await maxMtime(next));
      continue;
    }
    const info = await stat(next);
    latest = Math.max(latest, info.mtimeMs);
  }
  return latest;
}

async function serverSourceMtime(): Promise<number> {
  let latest = 0;
  for (const name of SERVER_SRC_PACKAGES) {
    const root = path.join(REPO_ROOT, "packages", name, "src");
    if (!existsSync(root)) continue;
    latest = Math.max(latest, await maxMtime(root));
  }
  return latest;
}

async function loadRun(): Promise<RunRecord | null> {
  if (!existsSync(RUN_FILE)) return null;
  try {
    const parsed: unknown = JSON.parse(await readFile(RUN_FILE, "utf8"));
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      !("pid" in parsed) ||
      !("origin" in parsed) ||
      typeof parsed.pid !== "number" ||
      typeof parsed.origin !== "string"
    ) {
      return null;
    }
    const sourceMtime =
      "sourceMtime" in parsed && typeof parsed.sourceMtime === "number" ? parsed.sourceMtime : 0;
    const processStartKeyValue =
      "processStartKey" in parsed &&
      typeof parsed.processStartKey === "string" &&
      parsed.processStartKey !== ""
        ? parsed.processStartKey
        : null;
    return { ...(parsed as RunRecord), sourceMtime, processStartKey: processStartKeyValue };
  } catch {
    return null;
  }
}

async function waitReady(child: ReturnType<typeof spawn>): Promise<{
  hostname: string;
  port: number;
  stdout: string;
  stderr: string;
}> {
  return await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`no ready line within ${READY_MS}ms. out=${stdout} err=${stderr}`));
    }, READY_MS);

    const settle = (error: Error | null, hostname?: string, port?: number): void => {
      clearTimeout(timer);
      if (error) {
        reject(error);
        return;
      }
      if (hostname === undefined || port === undefined) {
        reject(new Error(`ready line missing host/port. out=${stdout}`));
        return;
      }
      resolve({ hostname, port, stdout, stderr });
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      const match = READY.exec(stdout);
      if (match?.[1] === undefined || match[2] === undefined) return;
      settle(null, match[1], Number(match[2]));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => settle(error instanceof Error ? error : new Error(String(error))));
    child.on("exit", (code) => {
      settle(new Error(`server exited early (${code}). out=${stdout} err=${stderr}`));
    });
  });
}

async function buildDashboard(): Promise<void> {
  if (existsSync(DIST_INDEX)) return;
  const proc = spawn(BUN, ["run", "build:dashboard"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  const code: number | null = await new Promise((resolve) => {
    proc.on("exit", (exitCode) => resolve(exitCode));
  });
  if (code !== 0) fail("dashboard build failed", { code });
  if (!existsSync(DIST_INDEX)) fail("dashboard build did not write packages/dashboard/dist/index.html");
}

async function launch(): Promise<void> {
  const sourceMtime = await serverSourceMtime();
  const existing = await loadRun();
  if (existing !== null) {
    const ours = pidAlive(existing.pid) && (await originLooksLikeDashboard(existing.origin));
    if (ours && existing.sourceMtime === sourceMtime) {
      print({ ok: true, reused: true, ...existing });
      return;
    }
    if (ours) {
      if (tryKillRecorded(existing) === "mismatch") {
        fail("stale dashboard pid; recorded process identity did not match, not killed", {
          pid: existing.pid,
          origin: existing.origin,
        });
      }
    }
    await rm(RUN_FILE, { force: true });
  }

  await buildDashboard();

  const id = new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
  const evidenceDir = path.join(EVIDENCE_DIR, id);
  await mkdir(evidenceDir, { recursive: true });

  const child = spawn(BUN, [CLI, "--port", "0"], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    windowsHide: true,
  });
  if (child.pid === undefined) fail("dashboard-server spawned without a pid");

  let ready: Awaited<ReturnType<typeof waitReady>>;
  try {
    ready = await waitReady(child);
  } catch (error) {
    child.kill();
    fail(error instanceof Error ? error.message : String(error));
  }

  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
  const origin = `http://127.0.0.1:${ready.port}`;
  const record: RunRecord = {
    id,
    pid: child.pid,
    origin,
    hostname: ready.hostname,
    port: ready.port,
    cwd: REPO_ROOT,
    startedAt: new Date().toISOString(),
    evidenceDir,
    sourceMtime,
    processStartKey: processStartKey(child.pid),
  };
  await writeFile(RUN_FILE, `${JSON.stringify(record, null, 2)}\n`);
  print({ ok: true, reused: false, ...record });
}

async function doctor(): Promise<void> {
  const run = await loadRun();
  if (run === null) fail("no run file; launch first");
  if (!pidAlive(run.pid)) fail("recorded pid is not running", { pid: run.pid, origin: run.origin });

  const page = await fetchUrl(run.origin);
  if (!page.ok) fail("SPA did not answer", { status: page.status, origin: run.origin });
  if (!page.text.includes('id="root"') || !page.text.includes("AIDLC Guide")) {
    fail("SPA HTML is missing #root or title; dist may be stale, api-only, or a reused PID", {
      origin: run.origin,
    });
  }

  const workflowUrl = `${run.origin}/api/workflow`;
  const workflow = await fetchUrl(workflowUrl);
  if (!workflow.ok) {
    fail("HTTP was not 200", { url: workflowUrl, status: workflow.status, body: workflow.text.slice(0, 300) });
  }
  const body = parseJsonBody(workflow.text, workflowUrl, workflow.status);
  if (
    !isWorkflowPayload(body) &&
    !isTypedWorkflowError(body) &&
    !isUnsupportedWorkspace(body)
  ) {
    fail("/api/workflow JSON was not a known 200 variant", { body });
  }

  print({
    ok: true,
    origin: run.origin,
    pid: run.pid,
    cwd: run.cwd,
    evidenceDir: run.evidenceDir,
    distPresent: existsSync(DIST_INDEX),
    spaStatus: page.status,
    workflowStatus: workflow.status,
    body,
  });
}

async function origin(): Promise<void> {
  const run = await loadRun();
  if (run === null) fail("no run file; launch first");
  if (!pidAlive(run.pid)) fail("recorded pid is not running", { pid: run.pid });
  if (!(await originLooksLikeDashboard(run.origin))) {
    fail("recorded origin is not this Dashboard (stale PID or wrong server)", {
      pid: run.pid,
      origin: run.origin,
    });
  }
  print({ ok: true, origin: run.origin, pid: run.pid, evidenceDir: run.evidenceDir });
}

async function stop(): Promise<void> {
  const run = await loadRun();
  if (run === null) {
    print({ ok: true, stopped: false, reason: "no-run" });
    return;
  }
  const pidWasAlive = pidAlive(run.pid);
  const ours = pidWasAlive && (await originLooksLikeDashboard(run.origin));
  if (ours) {
    if (tryKillRecorded(run) === "mismatch") {
      fail("recorded origin looks like this Dashboard but process identity did not match; not killed", {
        pid: run.pid,
        origin: run.origin,
      });
    }
  }
  await rm(RUN_FILE, { force: true });
  print({
    ok: true,
    stopped: ours,
    pid: run.pid,
    origin: run.origin,
    skippedKill: pidWasAlive && !ours,
    evidenceDir: run.evidenceDir,
    evidenceKept: true,
  });
}

async function main(argv: readonly string[]): Promise<void> {
  const command = argv[0];
  if (command === undefined || !isCommand(command)) {
    fail("usage: bun .cursor/skills/verify-aidlc-guide/scripts/harness.ts <launch|doctor|origin|stop>");
  }
  switch (command) {
    case "launch":
      await launch();
      break;
    case "doctor":
      await doctor();
      break;
    case "origin":
      await origin();
      break;
    case "stop":
      await stop();
      break;
    default: {
      const _exhaustive: never = command;
      fail(`unhandled command: ${_exhaustive}`);
    }
  }
}

await main(process.argv.slice(2));
