import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { resolveIntents } from "@aidlc-guide/reader-core";

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
  const { active, all, space } = result.value;
  if (active !== null) {
    const via = all.length === 1 ? "lone-intent または active-intent" : "active-intent";
    return { ok: true, detail: `${active}（space: ${space} · ${via}）` };
  }
  if (all.length > 1) {
    return {
      ok: false,
      detail:
        `レコードが ${all.length} 件ありますが選択されていません。` +
        `\`/aidlc intent <slug>\` か aidlc/spaces/${space}/intents/active-intent で選んでください`,
    };
  }
  return { ok: false, detail: "Intent レコードがまだありません" };
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
    : { ok: true as const, value: { space: "default", active: null, all: [] as string[] } };
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
