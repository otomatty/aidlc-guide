import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SKELETON_DELAY_MS, useDelayedLoading } from "../src/hooks/useDelayedLoading.ts";
import {
  deriveViewState,
  deriveWorkflow,
  matrixNotes,
  workflowNotes,
} from "../src/store/derive-view-state.ts";
import { matrix, payload, workflow } from "./fixtures.ts";

/** The five states of refined-mockups Q2, plus the flicker threshold. */

describe("deriveViewState", () => {
  it("success: a clean ok result", () => {
    expect(deriveViewState({ ok: true, value: 1 })).toEqual({ kind: "success", value: 1 });
  });

  it("empty: no-active-intent is emptiness, not breakage", () => {
    const state = deriveViewState({ error: true, reason: "no-active-intent" });
    expect(state.kind).toBe("empty");
    expect(state.kind === "empty" && state.hint).toContain("アクティブなインテント");
  });

  it("error: an unsupported State Version names the version", () => {
    const state = deriveViewState({ unsupported: true, version: "9" });
    expect(state.kind).toBe("error");
    expect(state.kind === "error" && state.detail).toContain("9");
  });

  it("error: a transport failure says the server is unreachable", () => {
    const state = deriveViewState({ error: true, reason: "server-unreachable" });
    expect(state.kind === "error" && state.detail).toContain("サーバに接続できません");
  });

  it("error: an unknown reason is still shown, never swallowed", () => {
    const state = deriveViewState({ error: true, reason: "internal: boom" });
    expect(state.kind === "error" && state.detail).toContain("internal: boom");
  });

  it("partial: server warnings downgrade success and are carried", () => {
    const state = deriveViewState({ ok: true, value: 1, warnings: ["行 12 が読めません"] });
    expect(state).toEqual({ kind: "partial", value: 1, notes: ["行 12 が読めません"] });
  });

  it("partial: value-level degradation also downgrades success (BR-UI-4)", () => {
    const degraded = workflow({
      unparseable: { gate: "unknown mark" },
      stages: [...workflow().stages],
    });
    const state = deriveViewState({ ok: true, value: degraded }, workflowNotes);
    expect(state.kind).toBe("partial");
    expect(state.kind === "partial" && state.notes).toEqual(["gate: unknown mark"]);
  });
});

describe("degradation extractors", () => {
  it("reports per-stage unparseable marks", () => {
    const model = workflow();
    const [first] = model.stages;
    if (first === undefined) throw new Error("fixture has no stages");
    first.unparseable = "unknown G-3 mark";
    expect(workflowNotes(model)).toEqual(["intent-capture: unknown G-3 mark"]);
  });

  it("reports cell-level errors and nothing else", () => {
    const model = matrix();
    const [cell] = model.cells;
    if (cell === undefined) throw new Error("fixture has no cells");
    cell.error = "ディレクトリを読めません";
    expect(matrixNotes(model)).toEqual([
      "reader-core / functional-design: ディレクトリを読めません",
    ]);
  });
});

describe("deriveWorkflow", () => {
  it("applies one state-file warning to both slices", () => {
    const { workflow: w, nextStep } = deriveWorkflow({
      ok: true,
      value: payload(),
      warnings: ["Total Stages 欄が欠落"],
    });
    expect(w.kind).toBe("partial");
    expect(nextStep.kind).toBe("partial");
  });

  it("propagates an entry-level error to both slices", () => {
    const {
      workflow: w,
      nextStep,
      hostMode,
    } = deriveWorkflow({
      error: true,
      reason: "state-missing",
    });
    expect(w.kind).toBe("error");
    expect(nextStep.kind).toBe("error");
    // `null` = unknown. A failed read must not manufacture `false`, which
    // would read as "the server is not in host mode" (mob-mode S-MM-5).
    expect(hostMode).toBeNull();
  });
});

describe("useDelayedLoading (P-UI-5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays false for anything that resolves inside the threshold", () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedLoading(active), {
      initialProps: { active: true },
    });
    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS - 1);
    });
    expect(result.current).toBe(false);

    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(false);
  });

  it("turns true once the threshold elapses while still loading", () => {
    const { result } = renderHook(() => useDelayedLoading(true));
    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS);
    });
    expect(result.current).toBe(true);
  });

  it("resets when loading ends", () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedLoading(active), {
      initialProps: { active: true },
    });
    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS);
    });
    expect(result.current).toBe(true);
    rerender({ active: false });
    expect(result.current).toBe(false);
  });
});
