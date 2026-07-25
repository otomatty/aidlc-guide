import { relativize, type ToolReply } from "./render.ts";

/**
 * R-MS-1, layer 1. Wraps every tool handler so an unexpected exception becomes
 * an ordinary reply instead of a rejected promise.
 *
 * The stakes are asymmetric: this server is resident for the whole Claude Code
 * session, so one uncaught throw takes *all five* tools away for the rest of
 * the session (BR-MS-5). A wrong answer with a stated reason is strictly better
 * than a dead transport.
 *
 * Still not `isError` — an internal fault is data the AI can act on (retry a
 * different tool), not a protocol violation (BR-MS-3).
 */
export function safeHandler<A extends unknown[]>(
  workspaceRoot: string,
  fn: (...args: A) => Promise<ToolReply>,
): (...args: A) => Promise<ToolReply> {
  return async (...args: A): Promise<ToolReply> => {
    try {
      return await fn(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        text: relativize(`内部エラー: ${message}`, workspaceRoot),
        degraded: { kind: "error", detail: "internal" },
      };
    }
  };
}
