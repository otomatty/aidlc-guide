import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { resolveIntents } from "@aidlc-guide/reader-core";
import { resolveWorkflowsStatus } from "./workflows-version.ts";

const execFileAsync = promisify(execFile);

export interface DoctorCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  ready: boolean;
}

export async function onPath(command: string, args: string[] = ["--version"]): Promise<boolean> {
  try {
    await execFileAsync(command, args, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function intentDetail(
  hasAidlc: boolean,
  result: Awaited<ReturnType<typeof resolveIntents>>,
): { ok: boolean; detail: string } {
  if (!hasAidlc) {
    return { ok: false, detail: "aidlc/ が無いため判定できません" };
  }
  if (!("ok" in result)) {
    return { ok: false, detail: "Intent の解決に失敗しました" };
  }
  const { all, space } = result.value;
  if (all.length >= 1) {
    return { ok: true, detail: `${all.length} 件（space: ${space}）` };
  }
  return { ok: false, detail: "Intent レコードがまだありません" };
}

export function workflowsVersionCheck(workspaceRoot: string, docsRoot: string): DoctorCheck | null {
  const status = resolveWorkflowsStatus(workspaceRoot, docsRoot);
  switch (status.kind) {
    case "older":
      return {
        id: "workflows-version",
        label: "aidlc-workflows 版",
        ok: false,
        detail: `${status.workspace} → Guide 想定 ${status.pin}（Update Workflows）`,
      };
    case "current-or-newer":
      return {
        id: "workflows-version",
        label: "aidlc-workflows 版",
        ok: true,
        detail: `${status.workspace}（Guide 想定 ${status.pin}）`,
      };
    case "unparseable":
      if (status.pin === null) return null;
      return {
        id: "workflows-version",
        label: "aidlc-workflows 版",
        ok: false,
        detail: "AIDLC_VERSION を解釈できません。更新は手動で公式手順を参照してください。",
      };
    case "missing":
      return null;
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export async function runDoctor(
  workspaceRoot: string,
  docsRoot: string = workspaceRoot,
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];

  const aidlcDir = path.join(workspaceRoot, "aidlc");
  const hasAidlc = existsSync(aidlcDir);
  checks.push({
    id: "aidlc",
    label: "aidlc/ ワークスペース",
    ok: hasAidlc,
    detail: hasAidlc ? aidlcDir : "このフォルダに aidlc/ がありません",
  });

  const intents = hasAidlc
    ? await resolveIntents(workspaceRoot)
    : {
        ok: true as const,
        value: { space: "default", active: null, all: [] as string[], selected: null },
      };
  const intent = intentDetail(hasAidlc, intents);
  checks.push({
    id: "intent",
    label: "有効なIntent",
    ok: intent.ok,
    detail: intent.detail,
  });

  const bunOk = await onPath("bun");
  checks.push({
    id: "bun",
    label: "bun",
    ok: bunOk,
    detail: bunOk ? "PATH に bun があります" : "bun install に必要です — https://bun.sh",
  });

  const workflows = workflowsVersionCheck(workspaceRoot, docsRoot);
  if (workflows !== null) checks.push(workflows);

  const claudeOk = await onPath("claude");
  checks.push({
    id: "claude",
    label: "claude CLI",
    ok: claudeOk,
    detail: claudeOk
      ? "btw / MCP 連携に利用できます"
      : "任意 — Claude Code CLI が PATH にありません",
  });

  const ready = checks.filter((c) => c.id === "aidlc" || c.id === "intent").every((c) => c.ok);
  return { checks, ready };
}
