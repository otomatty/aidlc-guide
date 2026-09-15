import { execFile, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { PassThrough } from "node:stream";
import { expect, it, vi } from "vitest";
import { runCli } from "../src/ai-cli/process";

vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

it.each([undefined, 12345])(
  "waits for close after a child error with pid %s and retains the original cause",
  async (pid) => {
    const child = Object.assign(new EventEmitter(), {
      pid,
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(),
    });
    vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
    const resolved = vi.fn();
    const rejected = vi.fn();
    const result = runCli({
      command: "missing-cli",
      args: [],
      tool: "claude",
      cwd: tmpdir(),
      env: {},
      prompt: "question",
      signal: new AbortController().signal,
      onText: vi.fn(),
    }).then(resolved, rejected);
    const cause = new Error("spawn ENOENT");
    child.emit("error", cause);
    await Promise.resolve();
    expect(rejected).not.toHaveBeenCalled();
    child.emit("exit", 1);
    await Promise.resolve();
    expect(rejected).not.toHaveBeenCalled();
    child.emit("error", new Error("later child error"));
    child.emit("close", 1);
    await result;
    expect(resolved).not.toHaveBeenCalled();
    expect(rejected).toHaveBeenCalledExactlyOnceWith(cause);
  },
);

it("does not kill a closed child when pending registration later rejects", async () => {
  const child = Object.assign(new EventEmitter(), {
    pid: 12345,
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
  const registration = Promise.withResolvers<void>();
  const kill = vi.spyOn(process, "kill").mockReturnValue(true);
  vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
  vi.mocked(execFile).mockClear();
  try {
    const result = runCli({
      command: "test-cli",
      args: [],
      tool: "claude",
      cwd: tmpdir(),
      env: {},
      prompt: "question",
      signal: new AbortController().signal,
      onText: vi.fn(),
      onSpawn: () => registration.promise,
    });
    child.emit("close", 1);
    await expect(result).rejects.toThrow("cli-failed");
    registration.reject(new Error("registration failed"));
    await expect(registration.promise).rejects.toThrow("registration failed");
    expect(kill).not.toHaveBeenCalled();
    expect(execFile).not.toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
  } finally {
    kill.mockRestore();
  }
});
