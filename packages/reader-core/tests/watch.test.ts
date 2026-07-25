import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ChangeEvent, WatchEvent } from "@aidlc-guide/shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyScope, createChangeQueue, watch } from "../src/watch/watcher.ts";

const RECORD = path.join(path.sep, "rec", "intent-1");

describe("classifyScope", () => {
  it("classifies the state file", () => {
    expect(classifyScope(RECORD, path.join(RECORD, "aidlc-state.md"))).toBe("state");
  });

  it("classifies a construction change down to its unit", () => {
    expect(
      classifyScope(RECORD, path.join(RECORD, "construction", "reader-core", "x", "y.md")),
    ).toBe("matrix:reader-core");
  });

  it("classifies an audit shard", () => {
    expect(classifyScope(RECORD, path.join(RECORD, "audit", "clone.md"))).toBe("audit");
  });

  it("ignores a path outside the record", () => {
    expect(classifyScope(RECORD, path.join(path.sep, "elsewhere", "a.md"))).toBeNull();
  });

  it("ignores the record root itself", () => {
    expect(classifyScope(RECORD, RECORD)).toBeNull();
  });

  it("ignores a sibling whose name extends the record name", () => {
    expect(
      classifyScope(RECORD, path.join(path.sep, "rec", "intent-10", "audit", "a.md")),
    ).toBeNull();
  });

  it("ignores an unrelated file inside the record", () => {
    expect(classifyScope(RECORD, path.join(RECORD, "runtime-graph.json"))).toBeNull();
    expect(classifyScope(RECORD, path.join(RECORD, "ideation", "intent.md"))).toBeNull();
  });

  it("ignores construction/ itself, which names no unit", () => {
    expect(classifyScope(RECORD, path.join(RECORD, "construction"))).toBeNull();
  });
});

describe("createChangeQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits nothing before the debounce window closes", () => {
    const seen: ChangeEvent[] = [];
    const queue = createChangeQueue(300, (e) => seen.push(e));

    queue.push("state", "/rec/aidlc-state.md");
    vi.advanceTimersByTime(299);
    expect(seen).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(seen).toEqual([{ type: "change", scope: "state", path: "/rec/aidlc-state.md" }]);
  });

  it("coalesces a burst into one event per scope, keeping the last path", () => {
    const seen: ChangeEvent[] = [];
    const queue = createChangeQueue(300, (e) => seen.push(e));

    queue.push("state", "/a");
    queue.push("matrix:reader-core", "/b");
    queue.push("state", "/c");
    vi.advanceTimersByTime(300);

    expect(seen).toEqual([
      { type: "change", scope: "state", path: "/c" },
      { type: "change", scope: "matrix:reader-core", path: "/b" },
    ]);
  });

  it("restarts the window on each push (trailing debounce)", () => {
    const seen: ChangeEvent[] = [];
    const queue = createChangeQueue(300, (e) => seen.push(e));

    queue.push("audit", "/a");
    vi.advanceTimersByTime(200);
    queue.push("audit", "/b");
    vi.advanceTimersByTime(200);
    expect(seen).toEqual([]);

    vi.advanceTimersByTime(100);
    expect(seen).toEqual([{ type: "change", scope: "audit", path: "/b" }]);
  });

  it("drops pending events on cancel", () => {
    const seen: ChangeEvent[] = [];
    const queue = createChangeQueue(300, (e) => seen.push(e));

    queue.push("state", "/a");
    queue.cancel();
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual([]);
  });

  it("is a no-op to cancel an idle queue", () => {
    const queue = createChangeQueue(300, () => {
      throw new Error("must not emit");
    });
    expect(() => {
      queue.cancel();
    }).not.toThrow();
  });
});

describe("watch — real filesystem", () => {
  let record: string;

  beforeEach(async () => {
    record = await mkdtemp(path.join(tmpdir(), "watch-"));
    await mkdir(path.join(record, "construction", "unit-alpha"), { recursive: true });
    await mkdir(path.join(record, "audit"), { recursive: true });
    await writeFile(path.join(record, "aidlc-state.md"), "# state\n");
  });

  afterEach(async () => {
    await rm(record, { recursive: true, force: true });
  });

  /**
   * Collect events until `count` arrive, then **throw** if the deadline passes
   * first.
   *
   * The earlier version resolved with whatever had arrived, which turned "the
   * machine was too busy to deliver the third event in time" into a
   * wrong-scopes assertion failure — a misleading symptom that cost three
   * separate investigations. A timeout now says it is a timeout.
   *
   * The budget is deliberately generous: waiting longer costs nothing on a
   * passing run, and this suite has been observed with `environment` at 190s
   * under contention (a `git push` packing objects alongside the tests).
   */
  function collect(events: WatchEvent[], count: number, timeoutMs = 20000): Promise<WatchEvent[]> {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const poll = setInterval(() => {
        if (events.length >= count) {
          clearInterval(poll);
          resolve(events);
        } else if (Date.now() > deadline) {
          clearInterval(poll);
          reject(
            new Error(
              `timed out after ${timeoutMs}ms waiting for ${count} watch events; got ${events.length}: ` +
                JSON.stringify(events.map((e) => (e.type === "change" ? e.scope : e.type))),
            ),
          );
        }
      }, 20);
    });
  }

  /**
   * Wait until the watcher is demonstrably live, rather than sleeping a fixed
   * 400ms and hoping. A write issued before chokidar finishes attaching is
   * silently swallowed, and on a loaded machine 400ms is not always enough —
   * which is the second half of the flake `collect` used to disguise.
   *
   * Probes a file in a region none of the assertions inspect, then hands back
   * an event list that starts empty.
   */
  async function untilLive(
    record_: string,
    debounceMs: number,
  ): Promise<{
    events: WatchEvent[];
    dispose: () => void;
  }> {
    const probes: WatchEvent[] = [];
    const dispose = watch(record_, (e) => probes.push(e), { debounceMs });
    const probeFile = path.join(record_, "construction", "unit-probe", "probe.md");
    await mkdir(path.dirname(probeFile), { recursive: true });
    const deadline = Date.now() + 20000;
    for (let i = 0; probes.length === 0; i++) {
      if (Date.now() > deadline) {
        dispose();
        throw new Error("watcher never reported the probe write; it never went live");
      }
      await writeFile(probeFile, `probe ${i}\n`);
      await new Promise((r) => setTimeout(r, 100));
    }
    // Let any still-debounced probe traffic land *before* draining, or a late
    // `matrix:unit-probe` would arrive mid-assertion and fail the scope set.
    await new Promise((r) => setTimeout(r, debounceMs * 4 + 200));
    probes.length = 0;
    return { events: probes, dispose };
  }

  it("classifies changes to each of the three watched regions", async () => {
    const { events, dispose } = await untilLive(record, 30);

    await writeFile(path.join(record, "aidlc-state.md"), "# state v2\n");
    await writeFile(path.join(record, "construction", "unit-alpha", "note.md"), "hi\n");
    await writeFile(path.join(record, "audit", "clone.md"), "log\n");
    await collect(events, 3);
    dispose();

    const scopes = new Set(events.map((e) => (e.type === "change" ? e.scope : e.reason)));
    expect(scopes).toEqual(new Set(["state", "matrix:unit-alpha", "audit"]));
  });

  it("fires no callback after dispose (R-RC-4)", async () => {
    const events: WatchEvent[] = [];
    const dispose = watch(record, (e) => events.push(e), { debounceMs: 30 });
    await new Promise((r) => setTimeout(r, 400));

    dispose();
    await writeFile(path.join(record, "aidlc-state.md"), "# after dispose\n");
    await new Promise((r) => setTimeout(r, 400));

    expect(events).toEqual([]);
  });

  it("survives a watched file disappearing (git checkout, R-RC-4)", async () => {
    const events: WatchEvent[] = [];
    const dispose = watch(record, (e) => events.push(e), { debounceMs: 30 });
    await new Promise((r) => setTimeout(r, 400));

    await rm(path.join(record, "audit", "clone.md"), { force: true });
    await writeFile(path.join(record, "aidlc-state.md"), "# still alive\n");
    await collect(events, 1);
    dispose();

    expect(events.some((e) => e.type === "change" && e.scope === "state")).toBe(true);
    expect(events.some((e) => e.type === "watch-warning")).toBe(false);
  });
});
