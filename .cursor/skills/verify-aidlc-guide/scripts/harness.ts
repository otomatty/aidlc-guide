#!/usr/bin/env bun
/**
 * Launch, doctor, and stop a disposable AIDLC Guide dashboard-server.
 * Invocation is documented in ../SKILL.md. Never attach to a server this
 * process did not start.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

async function fetchUrl(url: string): Promise<Response> {
  try {
    return await fetch(url);
  } catch (error) {
    fail("request failed", { url, error: errorMessage(error) });
  }
}

async function readJsonBody(response: Response, url: string): Promise<unknown> {
  if (!response.ok) {
    const text = await response.text();
    fail("HTTP was not 200", { url, status: response.status, body: text.slice(0, 300) });
  }
  try {
    return await response.json();
  } catch (error) {
    fail("response was not JSON", { url, status: response.status, error: errorMessage(error) });
  }
}

async function originLooksLikeDashboard(origin: string): Promise<boolean> {
  try {
    const page = await fetch(origin);
    if (!page.ok) return false;
    const text = await page.text();
    return text.includes('id="root"') && text.includes("AIDLC Guide");
  } catch {
    return false;
  }
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
    return parsed as RunRecord;
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
  const existing = await loadRun();
  if (
    existing !== null &&
    pidAlive(existing.pid) &&
    (await originLooksLikeDashboard(existing.origin))
  ) {
    print({ ok: true, reused: true, ...existing });
    return;
  }
  if (existing !== null) await rm(RUN_FILE, { force: true });

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
  };
  await writeFile(RUN_FILE, `${JSON.stringify(record, null, 2)}\n`);
  print({ ok: true, reused: false, ...record });
}

async function doctor(): Promise<void> {
  const run = await loadRun();
  if (run === null) fail("no run file; launch first");
  if (!pidAlive(run.pid)) fail("recorded pid is not running", { pid: run.pid, origin: run.origin });

  const page = await fetchUrl(run.origin);
  const pageText = await page.text();
  if (!page.ok) fail("SPA did not answer", { status: page.status, origin: run.origin });
  if (!pageText.includes('id="root"') || !pageText.includes("AIDLC Guide")) {
    fail("SPA HTML is missing #root or title; dist may be stale, api-only, or a reused PID", {
      origin: run.origin,
    });
  }

  const workflowUrl = `${run.origin}/api/workflow`;
  const workflow = await fetchUrl(workflowUrl);
  const body = await readJsonBody(workflow, workflowUrl);
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
    try {
      process.kill(run.pid);
    } catch (error) {
      fail("failed to kill recorded pid", {
        pid: run.pid,
        error: errorMessage(error),
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
