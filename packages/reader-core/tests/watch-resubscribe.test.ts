import type { WatchEvent } from "@aidlc-guide/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The R-RC-4 resubscribe ladder, driven through a stand-in for chokidar.
 * A real watcher cannot be made to emit `error` on demand, and "the UI must be
 * told when it stops being live" is exactly the branch that must not rot.
 */

interface FakeWatcher {
  handlers: Map<string, (...args: unknown[]) => void>;
  closed: boolean;
}

const watchers: FakeWatcher[] = [];
/** Number of `chokidarWatch` calls that should throw before one succeeds. */
let failNextSubscribes = 0;

vi.mock("chokidar", () => ({
  watch: () => {
    if (failNextSubscribes > 0) {
      failNextSubscribes -= 1;
      throw new Error("EMFILE: too many open files");
    }
    const w: FakeWatcher = { handlers: new Map(), closed: false };
    watchers.push(w);
    return {
      on(event: string, handler: (...args: unknown[]) => void) {
        w.handlers.set(event, handler);
        return this;
      },
      close: async () => {
        w.closed = true;
      },
    };
  },
}));

const { watch } = await import("../src/watch/watcher.ts");

function fail(index: number): void {
  watchers[index]?.handlers.get("error")?.(new Error("watcher died"));
}

beforeEach(() => {
  watchers.length = 0;
  failNextSubscribes = 0;
});

describe("watch — subscription failures", () => {
  it("reports watcher-lost when the very first subscribe throws", () => {
    failNextSubscribes = 1;
    const events: WatchEvent[] = [];

    const dispose = watch("/rec", (e) => events.push(e));
    dispose();

    expect(events).toEqual([{ type: "watch-warning", reason: "watcher-lost" }]);
  });

  it("resubscribes silently up to the limit", () => {
    const events: WatchEvent[] = [];
    const dispose = watch("/rec", (e) => events.push(e), { maxResubscribes: 3 });

    fail(0);
    fail(1);
    fail(2);

    expect(watchers).toHaveLength(4); // initial + 3 replacements
    expect(watchers[0]?.closed).toBe(true);
    expect(events).toEqual([]);
    dispose();
  });

  it("reports resubscribe-failed once the limit is exceeded", () => {
    const events: WatchEvent[] = [];
    const dispose = watch("/rec", (e) => events.push(e), { maxResubscribes: 1 });

    fail(0); // resubscribed
    fail(1); // over the limit
    expect(events).toEqual([{ type: "watch-warning", reason: "resubscribe-failed" }]);
    dispose();
  });

  it("reports resubscribe-failed when the replacement subscribe itself throws", () => {
    const events: WatchEvent[] = [];
    const dispose = watch("/rec", (e) => events.push(e), { maxResubscribes: 3 });

    failNextSubscribes = 1;
    fail(0);

    expect(events).toEqual([{ type: "watch-warning", reason: "resubscribe-failed" }]);
    dispose();
  });

  it("stays silent about errors that arrive after dispose", () => {
    const events: WatchEvent[] = [];
    const dispose = watch("/rec", (e) => events.push(e));

    dispose();
    fail(0);

    expect(events).toEqual([]);
    expect(watchers).toHaveLength(1);
  });

  it("closes the watcher on dispose", () => {
    const dispose = watch("/rec", () => {});
    expect(watchers[0]?.closed).toBe(false);
    dispose();
    expect(watchers[0]?.closed).toBe(true);
  });
});
