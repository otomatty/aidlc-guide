#!/usr/bin/env bun
import { BtwFailure, fail } from "./errors.ts";
import { FORK_CAVEAT, HELP_TEXT } from "./help.ts";
import { parse } from "./parse.ts";
import { plan } from "./plan.ts";
import { resolveLatestSession } from "./resolve.ts";
import { runPlan } from "./spawn.ts";

const CLAUDE_MISSING =
  "claude CLI not found on PATH. Install Claude Code (https://claude.com/claude-code) " +
  "and make sure `claude` resolves in a non-interactive shell.";

async function main(argv: readonly string[]): Promise<number> {
  const command = parse(argv);

  // --help stays useful on a machine that has not installed Claude Code yet, so
  // it is answered before the prerequisite check. Every other mode needs the
  // binary, and the check runs exactly once (P-BTW-1).
  if (command.mode === "help") {
    process.stdout.write(HELP_TEXT);
    return 0;
  }

  if (Bun.which("claude") === null) {
    throw fail({
      reason: CLAUDE_MISSING,
      hint: "If claude is a shell alias or function, btw cannot see it — install the real binary.",
    });
  }

  const cwd = process.cwd();
  let sessionId: string | undefined;

  if (command.mode === "fork") {
    const session = await resolveLatestSession(cwd);
    sessionId = session.sessionId;
    process.stdout.write(`${FORK_CAVEAT}\n`);
  }

  const spawnPlan = plan(command, { platform: process.platform, cwd, sessionId });
  const code = await runPlan(spawnPlan, cwd);

  if (spawnPlan.launch === "terminal") {
    const from = sessionId === undefined ? "" : ` forked from session ${sessionId}`;
    process.stdout.write(
      `Opened a read-only (plan mode) Claude session in a new terminal${from}.\n`,
    );
  }
  return code;
}

// The single failure boundary (R-BTW-1): one line on stderr, an optional
// degraded-path hint, and a non-zero exit. No raw stack traces.
try {
  process.exit(await main(process.argv.slice(2)));
} catch (error) {
  if (error instanceof BtwFailure) {
    process.stderr.write(`btw: ${error.message}\n`);
    if (error.hint !== undefined) process.stderr.write(`btw: ${error.hint}\n`);
    process.exit(error.code);
  }
  process.stderr.write(
    `btw: internal error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
