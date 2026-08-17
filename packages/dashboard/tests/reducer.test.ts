import { LEGACY_STATE_WARNING, type WsMessage } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { reducer } from "../src/store/reducer.ts";
import { initialState, viewValue } from "../src/store/state.ts";
import { matrix, nextStep, payload, workflow } from "./fixtures.ts";

/** Each WsMessage variant lands in exactly one slice — and audit lands nowhere. */

/** Injected rather than read off the clock, so `lastChangeAt` is assertable. */
const CHANGE_AT = "2026-07-25T10:00:00.000Z";

const withMatrix = reducer(initialState, {
  type: "matrix",
  result: { ok: true, value: matrix() },
});

describe("reducer / REST results", () => {
  it("splits the /api/workflow payload into the workflow and nextStep slices", () => {
    const state = reducer(initialState, {
      type: "workflow",
      result: { ok: true, value: payload() },
    });
    expect(state.workflow.kind).toBe("success");
    expect(viewValue(state.workflow)?.currentStage).toBe("code-generation");
    expect(viewValue(state.nextStep)?.nextStage).toBe("build-and-test");
    expect(state.hostMode).toBe(false);
  });

  it("carries hostMode through from serverMode", () => {
    const state = reducer(initialState, {
      type: "workflow",
      result: { ok: true, value: payload({ serverMode: { hostMode: true } }) },
    });
    expect(state.hostMode).toBe(true);
  });

  it("keeps hostMode across a failed re-read — a blip must not leave host mode", () => {
    // `refetchAll` re-runs on every WS reconnect, so this is the ordinary
    // path, not an exotic one (mob-mode S-MM-5).
    const host = reducer(initialState, {
      type: "workflow",
      result: { ok: true, value: payload({ serverMode: { hostMode: true } }) },
    });
    for (const reason of ["state-missing", "no-active-intent"]) {
      const failed = reducer(host, { type: "workflow", result: { error: true, reason } });
      // `no-active-intent` derives to `empty`, `state-missing` to `error` —
      // either way the read did not succeed, so hostMode must not move.
      expect(failed.workflow.kind).not.toBe("success");
      expect(failed.hostMode, `${reason} downgraded hostMode`).toBe(true);
    }
    // Only a *successful* read may change it.
    const recovered = reducer(
      reducer(host, { type: "workflow", result: { error: true, reason: "x" } }),
      {
        type: "workflow",
        result: { ok: true, value: payload({ serverMode: { hostMode: false } }) },
      },
    );
    expect(recovered.hostMode).toBe(false);
  });

  it("keeps the matrix in loading while the background scan is building", () => {
    const state = reducer(initialState, { type: "matrix", result: { building: true } });
    expect(state.matrix.kind).toBe("loading");
  });
});

describe("reducer / WS messages", () => {
  it("matrix-ready fills the matrix slice", () => {
    const state = reducer(initialState, {
      type: "ws",
      receivedAt: CHANGE_AT,
      message: { type: "matrix-ready", matrix: matrix() },
    });
    expect(state.matrix.kind).toBe("success");
    expect(viewValue(state.matrix)?.cells).toHaveLength(3);
  });

  it("change/state replaces workflow and nextStep only", () => {
    const message: WsMessage = {
      type: "change",
      scope: "state",
      workflow: workflow({ currentStage: "build-and-test", done: 4 }),
      nextStep: nextStep({ nextStage: null, requirement: "完了" }),
    };
    const state = reducer(withMatrix, { type: "ws", message, receivedAt: CHANGE_AT });
    expect(viewValue(state.workflow)?.currentStage).toBe("build-and-test");
    expect(viewValue(state.workflow)?.done).toBe(4);
    expect(viewValue(state.nextStep)?.nextStage).toBeNull();
    expect(state.matrix).toBe(withMatrix.matrix);
  });

  it("keeps state-file warnings on a live state push", () => {
    const state = reducer(withMatrix, {
      type: "ws",
      receivedAt: CHANGE_AT,
      message: {
        type: "change",
        scope: "state",
        workflow: workflow(),
        nextStep: nextStep(),
        warnings: [LEGACY_STATE_WARNING],
      },
    });
    expect(state.workflow.kind).toBe("partial");
    expect(state.workflow.kind === "partial" && state.workflow.notes).toEqual([
      LEGACY_STATE_WARNING,
    ]);
    expect(state.nextStep.kind).toBe("partial");
  });

  it("change/matrix:<unit> replaces only that unit's cells", () => {
    const state = reducer(withMatrix, {
      type: "ws",
      receivedAt: CHANGE_AT,
      message: {
        type: "change",
        scope: "matrix:mcp-server",
        cells: [
          {
            unit: "mcp-server",
            stage: "functional-design",
            files: ["a.md", "b.md", "c.md", "d.md", "e.md", "f.md", "g.md"],
            verdict: "READY",
          },
        ],
      },
    });
    const cells = viewValue(state.matrix)?.cells ?? [];
    expect(cells.filter((cell) => cell.unit === "reader-core")).toHaveLength(2);
    expect(cells.find((cell) => cell.unit === "mcp-server")?.files).toHaveLength(7);
  });

  it("ignores a matrix scope push that arrives before the matrix exists", () => {
    const state = reducer(initialState, {
      type: "ws",
      message: { type: "change", scope: "matrix:mcp-server", cells: [] },
      receivedAt: CHANGE_AT,
    });
    // Every view slice is untouched by reference; only the liveness stamp
    // moves, because a change push proves the pipeline is alive even when it
    // renders nothing.
    for (const key of Object.keys(initialState) as (keyof typeof initialState)[]) {
      if (key === "live") continue;
      expect(state[key], `push rebuilt the ${key} slice`).toBe(initialState[key]);
    }
    expect(state.live.lastChangeAt).toBe(CHANGE_AT);
  });

  it("ignores change/audit entirely — this unit renders no audit view", () => {
    const before = reducer(withMatrix, {
      type: "workflow",
      result: { ok: true, value: payload() },
    });
    const after = reducer(before, {
      type: "ws",
      receivedAt: CHANGE_AT,
      message: {
        type: "change",
        scope: "audit",
        events: [
          {
            event: "STAGE_COMPLETED",
            stage: "x",
            timestamp: "2026-07-25T00:00:00Z",
            shard: "a",
            workflow: null,
          },
        ],
      },
    });
    // Every slice but `live` must come through by **reference** — a deep-equal
    // check would pass on a rebuilt object and hide an accidental fallthrough,
    // which is the whole point of this test.
    for (const key of Object.keys(before) as (keyof typeof before)[]) {
      if (key === "live") continue;
      expect(after[key], `audit push rebuilt the ${key} slice`).toBe(before[key]);
    }
    // …but an audit push is still a received change (mob-mode R-MM-3).
    expect(after.live.lastChangeAt).toBe(CHANGE_AT);
    expect(before.live.lastChangeAt).toBeUndefined();
  });

  it("live-status surfaces degradation with its reason", () => {
    const state = reducer(initialState, {
      type: "ws",
      receivedAt: CHANGE_AT,
      message: { type: "live-status", degraded: true, reason: "watcher-lost" },
    });
    expect(state.live).toEqual({
      connected: false,
      everConnected: false,
      degraded: true,
      reason: "watcher-lost",
    });
  });

  it("clears a stale reason when the server reports recovery", () => {
    const degraded = reducer(initialState, {
      type: "ws",
      receivedAt: CHANGE_AT,
      message: { type: "live-status", degraded: true, reason: "watcher-lost" },
    });
    const recovered = reducer(degraded, {
      type: "ws",
      receivedAt: CHANGE_AT,
      message: { type: "live-status", degraded: false },
    });
    expect(recovered.live.reason).toBeUndefined();
  });

  it("stamps the last change time from the socket, not from the reducer clock", () => {
    const state = reducer(initialState, {
      type: "ws",
      message: { type: "change", scope: "state", workflow: workflow(), nextStep: nextStep() },
      receivedAt: CHANGE_AT,
    });
    expect(state.live.lastChangeAt).toBe(CHANGE_AT);
  });
});

describe("reducer / local actions", () => {
  it("reconnecting clears the degraded flag", () => {
    const degraded = reducer(initialState, {
      type: "ws",
      receivedAt: CHANGE_AT,
      message: { type: "live-status", degraded: true },
    });
    expect(reducer(degraded, { type: "live", connected: true }).live).toEqual({
      connected: true,
      degraded: false,
      everConnected: true,
    });
  });

  it("separates a first connect from a drop, and keeps lastChangeAt across both", () => {
    // Before any socket has opened: connecting, not reconnecting.
    expect(initialState.live.everConnected).toBe(false);

    const changed = reducer(reducer(initialState, { type: "live", connected: true }), {
      type: "ws",
      message: { type: "change", scope: "state", workflow: workflow(), nextStep: nextStep() },
      receivedAt: CHANGE_AT,
    });
    const dropped = reducer(changed, { type: "live", connected: false });
    expect(dropped.live).toEqual({
      connected: false,
      degraded: false,
      everConnected: true,
      lastChangeAt: CHANGE_AT,
    });
    // Reconnecting keeps the fact that a change was once received.
    expect(reducer(dropped, { type: "live", connected: true }).live.lastChangeAt).toBe(CHANGE_AT);
  });

  it("memoises stage docs per slug", () => {
    const state = reducer(initialState, {
      type: "stage-doc",
      slug: "code-generation",
      state: { kind: "loading" },
    });
    expect(Object.keys(state.stageDoc)).toEqual(["code-generation"]);
  });

  it("reloading resets the three startup slices but keeps memoised docs", () => {
    const seeded = reducer(withMatrix, {
      type: "stage-doc",
      slug: "code-generation",
      state: { kind: "loading" },
    });
    const state = reducer(seeded, { type: "reloading" });
    expect(state.matrix.kind).toBe("loading");
    expect(state.workflow.kind).toBe("loading");
    expect(Object.keys(state.stageDoc)).toEqual(["code-generation"]);
  });

  it("select and theme update their own slice", () => {
    const selected = reducer(initialState, {
      type: "select",
      selection: { kind: "cell", unit: "reader-core", stage: "nfr-design" },
    });
    expect(selected.selected).toEqual({ kind: "cell", unit: "reader-core", stage: "nfr-design" });
    expect(reducer(selected, { type: "theme", theme: "dark" }).theme).toBe("dark");
  });
});
