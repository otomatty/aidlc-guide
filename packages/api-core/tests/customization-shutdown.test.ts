import { setImmediate as nextTurn } from "node:timers/promises";
import { afterEach, expect, it, vi } from "vitest";
import type { CliRunOptions } from "../src/ai-cli/process";
import { CustomizationStorage } from "../src/customization/storage";
import {
  type CustomizationAiContext,
  type CustomizationAiService,
  createCustomizationAiService,
} from "../src/customization-ai";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const context: CustomizationAiContext = {
  draft: {
    schemaVersion: 1,
    id: "draft",
    revision: 1,
    spaceId: "default",
    baseConfigurationRevision: "config",
    engineVersion: "2.8.2",
    capabilityProfile: "1",
    updatedAt: "",
    baseItems: [],
    removedItemIds: [],
    items: [],
  },
  catalog: {
    workspaceName: "test",
    spaceId: "default",
    spaces: ["default"],
    engineVersion: "2.8.2",
    configurationRevision: "config",
    capabilities: {
      available: true,
      engineVersion: "2.8.2",
      protocolVersion: 1,
      canApply: true,
      canExportPlugin: true,
      canRecover: true,
    },
    items: [],
    diagnostics: [],
    hostMode: false,
  },
};
const output = JSON.stringify({ schemaVersion: 1, summary: "No change", changes: [] });
const request = () => ({
  requestId: `${Date.now()}-shutdown-regression`,
  draftId: "draft",
  expectedDraftRevision: 1,
  message: "Review",
  tool: "claude",
});
const services: CustomizationAiService[] = [];
function setup(shutdownTimeoutMs = 1000) {
  const files = new Map<string, unknown>();
  const read = vi
    .spyOn(CustomizationStorage.prototype, "readJson")
    .mockImplementation(async (name) => structuredClone(files.get(name) ?? null));
  const write = vi
    .spyOn(CustomizationStorage.prototype, "writeJson")
    .mockImplementation(async (name, value) => {
      files.set(name, structuredClone(value));
    });
  let locks = 0;
  const lock = vi
    .spyOn(CustomizationStorage.prototype, "withLock")
    .mockImplementation(async (_name, action) => {
      locks++;
      try {
        return await action();
      } finally {
        locks--;
      }
    });
  const getContext = vi.fn(async () => context);
  const run = vi.fn(async (_options: CliRunOptions) => output);
  const identity = vi.fn(async (pid: number) => `test:${pid}`);
  const cleanup = vi.fn(async () => {});
  const probe = vi.fn(async (tool: "claude" | "cursor" | "copilot") => ({
    tool,
    label: tool,
    available: true,
    command: "unused",
  }));
  const service = createCustomizationAiService({
    workspaceRoot: "unused",
    hostMode: false,
    context: getContext,
    propose: vi.fn(),
    dependencies: {
      probe,
      run,
      identity,
      scratch: async () => ({ cwd: "unused", env: {}, cleanup }),
      shutdownTimeoutMs,
    },
  });
  services.push(service);
  const jobs = () =>
    (files.get("jobs/index.json") as { jobs: { job: { phase: string } }[] } | undefined)?.jobs ??
    [];
  return {
    service,
    files,
    read,
    write,
    lock,
    run,
    identity,
    cleanup,
    probe,
    getContext,
    jobs,
    locks: () => locks,
  };
}
afterEach(async () => {
  const closing = services.splice(0);
  for (const service of closing) service.dispose();
  const outcomes = await Promise.allSettled(closing.map((service) => service.close()));
  vi.restoreAllMocks();
  vi.useRealTimers();
  const errors = outcomes.filter((outcome) => outcome.status === "rejected");
  if (errors.length) throw new AggregateError(errors.map((outcome) => outcome.reason));
});

it("waits for the terminal write's lock to return even after readers see completed", async () => {
  const h = setup();
  const written = deferred();
  const release = deferred();
  const write = h.write.getMockImplementation();
  h.write.mockImplementation(async (name, value) => {
    await write?.(name, value);
    if (h.jobs().some((entry) => entry.job.phase === "completed")) {
      written.resolve();
      await release.promise;
    }
  });
  await h.service.start(request());
  await written.promise;
  const reading = await h.service.conversation("draft");
  expect(reading).toMatchObject({ value: { jobs: [{ phase: "completed" }] } });
  const closing = h.service.close();
  let closed = false;
  void closing.then(() => {
    closed = true;
  });
  try {
    await nextTurn();
    expect(closed).toBe(false);
    expect(h.locks()).toBe(1);
    expect(h.service.close()).toBe(closing);
  } finally {
    release.resolve();
  }
  await closing;
  expect(h.locks()).toBe(0);
});

it("waits for an admitted start and rejects it before launching a CLI after disposal", async () => {
  const h = setup();
  const entered = deferred();
  const release = deferred<CustomizationAiContext>();
  h.getContext.mockImplementation(async () => {
    entered.resolve();
    return release.promise;
  });
  const starting = h.service.start(request());
  await entered.promise;
  const closing = h.service.close();
  expect(await h.service.start(request())).toMatchObject({ reason: "disposed" });
  expect(await h.service.tools()).toMatchObject({ reason: "disposed" });
  release.resolve(context);
  expect(await starting).toMatchObject({ reason: "disposed" });
  await closing;
  expect(h.run).not.toHaveBeenCalled();
  expect(h.jobs()).toEqual([]);
});

it("drains request lookups that were admitted before close", async () => {
  const h = setup();
  const entered = deferred();
  const release = deferred<null>();
  h.read.mockImplementationOnce(async () => {
    entered.resolve();
    return release.promise;
  });
  const reading = h.service.request("old-request");
  await entered.promise;
  const closing = h.service.close();
  let closed = false;
  void closing.then(() => {
    closed = true;
  });
  await nextTurn();
  expect(closed).toBe(false);
  release.resolve(null);
  expect(await reading).toBeNull();
  await closing;
});

it("settles a reservation persisted during close without launching a CLI", async () => {
  const h = setup();
  const written = deferred();
  const release = deferred();
  const write = h.write.getMockImplementation();
  h.write.mockImplementationOnce(async (name, value) => {
    await write?.(name, value);
    written.resolve();
    await release.promise;
  });
  const starting = h.service.start(request());
  await written.promise;
  const closing = h.service.close();
  release.resolve();
  await starting;
  await closing;
  expect(h.run).not.toHaveBeenCalled();
  expect(h.jobs()[0]?.job.phase).toBe("cancelled");
  expect(h.locks()).toBe(0);
});

it("waits for an already running monitor tick after stopping its timer", async () => {
  vi.useFakeTimers();
  const h = setup();
  const running = deferred();
  h.run.mockImplementation(
    (options) =>
      new Promise((resolve) => {
        running.resolve();
        options.signal.addEventListener("abort", () => resolve(output), { once: true });
      }),
  );
  await h.service.start(request());
  await running.promise;
  const tick = deferred();
  const release = deferred();
  h.lock.mockImplementationOnce(async (_name, action) => {
    tick.resolve();
    await release.promise;
    return action();
  });
  await vi.advanceTimersByTimeAsync(500);
  await tick.promise;
  const closing = h.service.close();
  let closed = false;
  void closing.then(() => {
    closed = true;
  });
  await nextTurn();
  expect(closed).toBe(false);
  release.resolve();
  await closing;
  expect(h.jobs()[0]?.job.phase).toBe("cancelled");
  expect(vi.getTimerCount()).toBe(0);
});

it("joins late process registration even if the CLI result has already settled", async () => {
  const h = setup();
  const entered = deferred();
  const release = deferred<string>();
  h.identity.mockImplementation(async (pid) => {
    if (pid !== 123456) return `test:${pid}`;
    entered.resolve();
    return release.promise;
  });
  h.run.mockImplementation(async (options) => {
    void options.onSpawn?.(123456).catch(() => {});
    return output;
  });
  await h.service.start(request());
  await entered.promise;
  const closing = h.service.close();
  let closed = false;
  void closing.then(() => {
    closed = true;
  });
  await nextTurn();
  expect(closed).toBe(false);
  expect(h.cleanup).not.toHaveBeenCalled();
  release.resolve("test:123456");
  await closing;
  expect(h.jobs()[0]?.job.phase).toBe("cancelled");
  expect(h.cleanup).toHaveBeenCalledOnce();
});

it("reports a bounded shutdown timeout and keeps new work refused", async () => {
  vi.useFakeTimers();
  const h = setup(50);
  const entered = deferred();
  const release = deferred<CustomizationAiContext>();
  h.getContext.mockImplementation(async () => {
    entered.resolve();
    return release.promise;
  });
  const starting = h.service.start(request());
  await entered.promise;
  const closing = h.service.close();
  const rejected = expect(closing).rejects.toMatchObject({ code: "shutdown-timeout" });
  await vi.advanceTimersByTimeAsync(50);
  await rejected;
  expect(await h.service.request("later")).toMatchObject({ reason: "disposed" });
  release.resolve(context);
  await starting;
  expect(h.run).not.toHaveBeenCalled();
  // The rejected close is intentionally sticky; this test has released its only task.
  services.splice(services.indexOf(h.service), 1);
});

it("drains remaining CLI probes even if another probe has already failed", async () => {
  const h = setup();
  const entered = deferred();
  const release = deferred();
  h.probe.mockImplementation(async (tool) => {
    if (tool === "claude") throw new Error("probe-failed");
    if (tool === "cursor") {
      entered.resolve();
      await release.promise;
    }
    return { tool, label: tool, available: true, command: "unused" };
  });
  const probing = h.service.tools();
  await entered.promise;
  expect(await probing).toMatchObject({ error: true });
  const closing = h.service.close();
  let closed = false;
  void closing.then(() => {
    closed = true;
  });
  await nextTurn();
  expect(closed).toBe(false);
  release.resolve();
  await closing;
});

it("recovers its own failed terminal write while closing", async () => {
  const h = setup();
  const attempted = deferred();
  const write = h.write.getMockImplementation();
  let failed = false;
  h.write.mockImplementation(async (name, data) => {
    const jobs = (data as { jobs: { job: { phase: string } }[] }).jobs;
    if (!failed && jobs.some((entry) => entry.job.phase === "completed")) {
      failed = true;
      attempted.resolve();
      throw new Error("transient-write-failure");
    }
    await write?.(name, data);
  });
  await h.service.start(request());
  await attempted.promise;
  await h.service.close();
  expect(h.jobs()[0]?.job.phase).toBe("interrupted");
  expect(h.locks()).toBe(0);
});
