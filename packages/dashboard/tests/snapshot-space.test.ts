import { afterEach, expect, it, vi } from "vitest";
import { refetchAll, refetchAfterSpaceSelect } from "@/services/api.ts";
import { type Action, reducer } from "@/store/reducer.ts";
import { initialState, viewValue } from "@/store/state.ts";
import { payload, matrix } from "./fixtures.ts";

afterEach(() => vi.unstubAllGlobals());
const identity = (space: string, intent = "shared") => ({ space, intent });
const workflow = (space: string, intent = "shared") => {
  const result = payload();
  result.workflow.record = identity(space, intent);
  return result;
};
const intents = (space: string, selected: string | null = "shared") => ({
  ok: true,
  value: { space, active: selected, selected, all: selected ? [selected] : [] },
});

it.each(["workflow", "matrix", "intent"])(
  "retries a mixed %s response before dispatching any record data",
  async (mixed) => {
    let batch = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/workflow") batch++;
      const old = batch === 1;
      const body =
        url === "/api/workflow"
          ? workflow(
              old && mixed === "workflow" ? "default" : "team-b",
              old && mixed === "intent" ? "other" : "shared",
            )
          : url === "/api/matrix"
            ? {
                ok: true,
                value: matrix({
                  record: identity(old && mixed === "matrix" ? "default" : "team-b"),
                }),
              }
            : intents("team-b");
      return new Response(JSON.stringify(body));
    });
    vi.stubGlobal("fetch", fetchMock);
    const actions: Action[] = [];
    await refetchAll((action) => actions.push(action));
    expect(batch).toBe(2);
    expect(actions.map((action) => action.type)).toEqual(["intents", "workflow", "matrix"]);
    const state = actions.reduce(reducer, initialState);
    expect(viewValue(state.intents)?.space).toBe("team-b");
    expect(viewValue(state.workflow)?.record).toEqual(identity("team-b"));
    expect(viewValue(state.matrix)?.record).toEqual(identity("team-b"));
  },
);

it("bounds retries and clears record data when the space keeps changing", async () => {
  const fetchMock = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url === "/api/workflow"
            ? workflow("default")
            : url === "/api/matrix"
              ? { ok: true, value: matrix({ record: identity("default") }) }
              : intents("team-b"),
        ),
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  const actions: Action[] = [];
  await refetchAll((action) => actions.push(action));
  expect(fetchMock).toHaveBeenCalledTimes(9);
  const state = actions.reduce(reducer, initialState);
  expect(viewValue(state.intents)?.space).toBe("team-b");
  expect(state.workflow.kind).toBe("error");
  expect(state.matrix.kind).toBe("error");
});

it("keeps the empty-space state and the matrix building response renderable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === "/api/workflow"
              ? { error: true, reason: "no-active-intent" }
              : url === "/api/matrix"
                ? { building: true }
                : intents("empty", null),
          ),
        ),
    ),
  );
  const actions: Action[] = [];
  await refetchAfterSpaceSelect((action) => actions.push(action), "empty", null);
  const state = actions.reduce(reducer, initialState);
  expect(state.workflow.kind).toBe("empty");
  expect(state.matrix.kind).toBe("loading");
  expect(viewValue(state.intents)?.space).toBe("empty");
});

it.each(["workflow", "matrix"])(
  "rejects a successful %s response without record identity",
  async (missing) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          new Response(
            JSON.stringify(
              url === "/api/workflow"
                ? missing === "workflow"
                  ? payload()
                  : workflow("team-b")
                : url === "/api/matrix"
                  ? {
                      ok: true,
                      value: matrix(missing === "matrix" ? {} : { record: identity("team-b") }),
                    }
                  : intents("team-b"),
            ),
          ),
      ),
    );
    const actions: Action[] = [];
    await refetchAll((action) => actions.push(action));
    const state = actions.reduce(reducer, initialState);
    expect(state.workflow.kind).toBe("error");
    expect(state.matrix.kind).toBe("error");
  },
);

it("abandons a retry overtaken by a newer space selection", async () => {
  let batch = 0;
  let entered = () => {};
  const retryStarted = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/workflow") batch++;
      const current = batch;
      const space = current < 3 ? "team-b" : "team-c";
      const body =
        url === "/api/workflow"
          ? workflow(current === 1 ? "default" : space)
          : url === "/api/matrix"
            ? { ok: true, value: matrix({ record: identity(space) }) }
            : intents(space);
      if (current === 2 && url === "/api/workflow") {
        entered();
        await held;
      }
      return new Response(JSON.stringify(body));
    }),
  );
  const actions: Action[] = [];
  const earlier = refetchAll((action) => actions.push(action));
  await retryStarted;
  await refetchAfterSpaceSelect((action) => actions.push(action), "team-c", "shared");
  release();
  await earlier;
  expect(actions.filter((action) => action.type === "workflow")).toHaveLength(1);
  const state = actions.reduce(reducer, initialState);
  expect(viewValue(state.workflow)?.record).toEqual(identity("team-c"));
  expect(viewValue(state.matrix)?.record).toEqual(identity("team-c"));
});
