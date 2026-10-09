import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { inspectVersionGate, resolveIntents } from "@aidlc-guide/reader-core";
import {
  VERSION_GATE_ACTIONS,
  type VersionGate,
  versionGateActionLabel,
  WORKFLOWS_TARGET_VERSION,
} from "@aidlc-guide/shared-types";

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

/** The same version check every surface enforces (docs/maintenance/version-gate-design.md). */
export function workflowsVersionCheck(
  workspaceRoot: string,
  inspect: (root: string) => VersionGate = (root) =>
    inspectVersionGate(root, WORKFLOWS_TARGET_VERSION),
): DoctorCheck | null {
  const gate = inspect(workspaceRoot);
  if (gate.status === "not-installed") return null;
  const versions = [...new Set(gate.tools.map((tool) => tool.version ?? "不明"))].join("、");
  return {
    id: "workflows-version",
    label: "aidlc-workflows バージョン",
    ok: gate.status === "ok",
    detail:
      gate.status === "ok"
        ? `${versions}（Guide 対応版 ${gate.target}）`
        : `${gate.message}（${versionGateActionLabel(VERSION_GATE_ACTIONS[gate.status], gate.target)}）`,
  };
}

export async function runDoctor(workspaceRoot: string): Promise<DoctorReport> {
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
    label: "bun（文書参照 MCP 用）",
    ok: bunOk,
    detail: bunOk ? "PATH に bun があります" : "文書参照 MCP を使う場合に必要です — https://bun.sh",
  });

  const workflows = workflowsVersionCheck(workspaceRoot);
  if (workflows !== null) checks.push(workflows);

  const claudeOk = await onPath("claude");
  checks.push({
    id: "claude",
    label: "claude CLI",
    ok: claudeOk,
    detail: claudeOk
      ? "文書参照 MCP に利用できます"
      : "任意 — Claude Code CLI が PATH にありません",
  });

  const ready = checks.filter((c) => c.id === "aidlc" || c.id === "intent").every((c) => c.ok);
  return { checks, ready };
}
