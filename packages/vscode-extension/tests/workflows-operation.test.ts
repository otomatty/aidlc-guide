import { describe, expect, it, vi } from "vitest";
import { acquireWorkflowsOperation, onWorkflowsChanged } from "../src/workflows-operation.ts";

describe("workflows operation ownership", () => {
  it("does not let a repeated release unlock a later operation or notify twice", () => {
    const changed = vi.fn();
    const unsubscribe = onWorkflowsChanged(changed);
    const first = acquireWorkflowsOperation("first");
    let second: (() => void) | null = null;
    try {
      expect(first).not.toBeNull();
      expect(acquireWorkflowsOperation("second")).toBeNull();
      first?.();
      expect(changed).toHaveBeenCalledOnce();
      second = acquireWorkflowsOperation("second");
      expect(second).not.toBeNull();
      first?.();
      expect(acquireWorkflowsOperation("third")).toBeNull();
      expect(changed).toHaveBeenCalledOnce();
      second?.();
      expect(changed).toHaveBeenCalledTimes(2);
    } finally {
      first?.();
      second?.();
      unsubscribe();
    }
  });
});
