import { execFile, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { PassThrough } from "node:stream";
import { expect, it, vi } from "vitest";
import { probeTool, runCli } from "../src/ai-cli/process";

vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

it("does not launch a probe when already cancelled", async () => {
  vi.mocked(execFile).mockClear();
  const controller = new AbortController();
  const reason = new Error("cancelled before probing");
  controller.abort(reason);
  await expect(probeTool("cursor", controller.signal)).rejects.toBe(reason);
  expect(execFile).not.toHaveBeenCalled();
});

it("passes cancellation to the running probe and never launches the fallback candidate", async () => {
  const controller = new AbortController();
  const reason = Object.assign(new Error("cancelled during probing"), { cmd: "agent --help" });
  vi.mocked(execFile)
    .mockReset()
    .mockImplementation((_command, _args, options, callback) => {
      expect(options).toMatchObject({
        signal: controller.signal,
        timeout: 10_000,
        windowsHide: true,
      });
      controller.signal.addEventListener("abort", () => callback?.(reason, "", ""), { once: true });
      return {} as ReturnType<typeof execFile>;
    });
  const result = probeTool("cursor", controller.signal);
  controller.abort(reason);
  await expect(result).rejects.toBe(reason);
  expect(execFile).toHaveBeenCalledOnce();
  expect(vi.mocked(execFile).mock.calls[0]?.[0]).toBe("agent");
});

it("still tries fallback candidates for ordinary probe failures without a signal", async () => {
  vi.mocked(execFile)
    .mockReset()
    .mockImplementation((_command, _args, _options, callback) => {
      callback?.(Object.assign(new Error("ENOENT"), { cmd: "agent --help" }), "", "");
      return {} as ReturnType<typeof execFile>;
    });
  await expect(probeTool("cursor")).resolves.toMatchObject({ available: false });
  expect(vi.mocked(execFile).mock.calls.map(([command]) => command)).toEqual([
    "agent",
    "cursor-agent",
  ]);
});

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
