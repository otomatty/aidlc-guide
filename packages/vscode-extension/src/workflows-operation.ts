import { realpathSync } from "node:fs";
import path from "node:path";

let running: symbol | null = null;
const listeners = new Set<() => void>();

export const WORKFLOWS_BUSY_MESSAGE =
  "別のフォルダを含むインストールまたは更新が実行中です。完了してから再実行してください。";

export function workflowsRootKey(root: string): string {
  let resolved = path.resolve(root);
  try {
    resolved = realpathSync(resolved);
  } catch {
    // Preserve exclusion even if a folder disappears during an operation.
  }
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export const workflowsRepairKey = (root: string): string =>
  `aidlc-guide.workflows-repair:${workflowsRootKey(root)}`;

export function onWorkflowsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Serialize installation and update across all roots in this extension host.
 * Hold through machine-default reads, activation, restoration and final diagnostics.
 */
export function acquireWorkflowsOperation(root: string): (() => void) | null {
  if (running !== null) return null;
  const operation = Symbol(root);
  running = operation;
  return () => {
    if (running !== operation) return;
    running = null;
    for (const listener of listeners) listener();
  };
}
