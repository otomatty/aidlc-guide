import { fail } from "./errors.ts";
import type { SpawnPlan } from "./plan.ts";

/**
 * Execute a SpawnPlan.
 *
 * Always the array form of `Bun.spawn` — no shell, no string concatenation, so
 * nothing in the argv can be reinterpreted as a command (S-BTW-2).
 *
 * `terminal`: fire-and-forget, unref'd so btw can exit immediately (P-BTW-1).
 * `inline`:   stdio inherited so the child's output and exit code pass straight
 *             through, and Ctrl-C reaches the child (P-BTW-3).
 */
export async function runPlan(spawnPlan: SpawnPlan, cwd: string): Promise<number> {
  const argv = [spawnPlan.command, ...spawnPlan.args];
  try {
    if (spawnPlan.launch === "inline") {
      const child = Bun.spawn(argv, { cwd, stdio: ["inherit", "inherit", "inherit"] });
      return await child.exited;
    }
    const child = Bun.spawn(argv, { cwd, stdio: ["ignore", "ignore", "ignore"] });
    child.unref();
    return 0;
  } catch (cause) {
    throw fail({
      reason: `failed to start "${spawnPlan.command}" on ${process.platform}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    });
  }
}
