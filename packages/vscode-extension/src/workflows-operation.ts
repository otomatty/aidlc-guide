import { realpathSync } from "node:fs";
import path from "node:path";

const running = new Set<string>();
const listeners = new Set<() => void>();

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

/** Shared by installation and update, including multiple panels for one folder. */
export function acquireWorkflowsOperation(root: string): (() => void) | null {
  const key = workflowsRootKey(root);
  if (running.has(key)) return null;
  running.add(key);
  return () => {
    running.delete(key);
    for (const listener of listeners) listener();
  };
}
