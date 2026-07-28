import { fail } from "./errors.ts";
import type { BtwCommand } from "./parse.ts";

/**
 * How a session is to be started (domain-entities.md).
 * `terminal` = a fresh terminal window (OS-branched); `inline` = the current
 * terminal, synchronously.
 */
export interface SpawnPlan {
  launch: "terminal" | "inline";
  platform?: "darwin" | "win32";
  command: string;
  args: string[];
}

/**
 * S-BTW-1's single enforcement point: every plan concatenates this, so there is
 * no code path that starts a session outside read-only plan mode.
 */
export const basePlanArgs: readonly string[] = ["--permission-mode", "plan"];

const CLAUDE = "claude";

export interface PlanContext {
  /** `process.platform` (BR-4: OS detection lives here and nowhere else). */
  platform: string;
  /** Working directory the session should start in. */
  cwd: string;
  /** Required for `mode: "fork"`. */
  sessionId?: string;
}

/** POSIX single-quote a string so a shell treats it as one literal argument. */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/** Quote a string as an AppleScript string literal. */
function appleScriptQuote(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/** The `claude ...` argv every mode ultimately runs. */
function claudeArgv(command: BtwCommand, sessionId: string | undefined): string[] {
  switch (command.mode) {
    case "side":
      return [CLAUDE, ...basePlanArgs];
    case "fork": {
      if (sessionId === undefined || sessionId === "") {
        throw fail({ reason: "internal: fork plan requested without a resolved session id" });
      }
      return [CLAUDE, "--fork-session", sessionId, ...basePlanArgs];
    }
    case "headless":
      return [CLAUDE, "-p", command.prompt, ...basePlanArgs];
    case "help":
      throw fail({ reason: "internal: help does not spawn a session" });
  }
}

/**
 * (BtwCommand, context) -> SpawnPlan. The only place a launch is described, for
 * every mode, so `basePlanArgs` cannot be bypassed (nfr-design logical-components).
 */
export function plan(command: BtwCommand, ctx: PlanContext): SpawnPlan {
  const argv = claudeArgv(command, ctx.sessionId);
  const [command0, ...rest] = argv as [string, ...string[]];

  // Headless: no new window, no OS branch — run it right here and pass the
  // user's prompt as its own argv element (S-BTW-2: never through a shell).
  if (command.mode === "headless") {
    return { launch: "inline", command: command0, args: rest };
  }

  switch (ctx.platform) {
    case "win32":
      // `start` opens the new console window; `cmd /k` keeps it alive after the
      // session ends. cwd is inherited from the parent via Bun.spawn's `cwd`.
      return {
        launch: "terminal",
        platform: "win32",
        command: "cmd",
        args: ["/c", "start", "btw", "cmd", "/k", ...argv],
      };
    case "darwin": {
      // Terminal.app always opens a fresh login shell in the home directory, so
      // the cwd has to be re-established inside the script. Two quoting layers,
      // both applied: shell-quoting inside, AppleScript-quoting outside — this
      // is what keeps a cwd containing spaces or `&` intact (R-BTW-4).
      const shellLine = `cd ${shellQuote(ctx.cwd)} && exec ${argv.map(shellQuote).join(" ")}`;
      return {
        launch: "terminal",
        platform: "darwin",
        command: "osascript",
        args: [
          "-e",
          `tell application "Terminal" to do script ${appleScriptQuote(shellLine)}`,
          "-e",
          'tell application "Terminal" to activate',
        ],
      };
    }
    default:
      throw fail({
        reason: `unsupported platform "${ctx.platform}". btw supports macOS (darwin) and Windows (win32).`,
      });
  }
}
