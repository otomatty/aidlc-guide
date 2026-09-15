import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { expect, it, vi } from "vitest";
import { CustomizationStorage } from "../src/customization/storage";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

it("retains the lock exit cause and stderr without running an unlocked mutation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "customization-lock-error-"));
  const stderr = `${"details ".repeat(500)}lock-runtime-unavailable: missing flock`;
  const message = `customization-lock-exited:1:${stderr.slice(-2000)}`;
  try {
    const child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(),
    });
    vi.mocked(spawn).mockImplementation(() => {
      queueMicrotask(() => {
        child.stderr.write(stderr.slice(0, 2500));
        child.stderr.write(stderr.slice(2500));
        child.emit("close", 1);
      });
      return child as unknown as ReturnType<typeof spawn>;
    });
    const action = vi.fn();
    await expect(new CustomizationStorage(root).withLock("draft", action)).rejects.toMatchObject({
      code: "local-storage-unavailable",
      status: 503,
      cause: { message },
      diagnostics: [
        {
          severity: "error",
          code: "lock-runtime-unavailable",
          message,
        },
      ],
    });
    expect(action).not.toHaveBeenCalled();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("waits for the lock process to close after an error before finishing cleanup", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "customization-lock-close-"));
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
  const spawned = Promise.withResolvers<void>();
  vi.mocked(spawn).mockImplementation(() => {
    spawned.resolve();
    return child as unknown as ReturnType<typeof spawn>;
  });
  const action = vi.fn();
  const rejected = vi.fn();
  const result = new CustomizationStorage(root).withLock("draft", action).catch(rejected);
  try {
    await spawned.promise;
    const released = new Promise<void>((resolve) => child.stdin.once("finish", resolve));
    const cause = new Error("lock process error");
    child.emit("error", cause);
    await released;
    expect(rejected).not.toHaveBeenCalled();
    child.emit("error", new Error("later child error"));
    child.emit("close", 1);
    await result;
    expect(action).not.toHaveBeenCalled();
    expect(rejected).toHaveBeenCalledWith(
      expect.objectContaining({ code: "local-storage-unavailable", cause }),
    );
  } finally {
    child.emit("close", 1);
    await result;
    await rm(root, { recursive: true, force: true });
  }
});
