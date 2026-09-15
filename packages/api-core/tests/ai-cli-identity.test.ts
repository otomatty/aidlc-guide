import { readFile } from "node:fs/promises";
import { afterEach, expect, it, vi } from "vitest";
import { stopOwnedProcess } from "../src/ai-cli/identity";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function processes(starts: number[]) {
  const kill = vi.fn(() => true);
  const fake = Object.create(process);
  Object.defineProperties(fake, { platform: { value: "linux" }, kill: { value: kill } });
  vi.stubGlobal("process", fake);
  vi.mocked(readFile).mockImplementation(async () => {
    const start = starts.length > 1 ? starts.shift() : starts[0];
    return `123 (child) ${Array(19).fill("0").join(" ")} ${start}`;
  });
  return kill;
}

it("waits for asynchronous termination and accepts a changed PID identity without signaling again", async () => {
  vi.useFakeTimers();
  const kill = processes([1, 1, 1, 2]);
  const stopping = stopOwnedProcess(123, "linux:123:1");
  await vi.advanceTimersByTimeAsync(100);
  await expect(stopping).resolves.toBe(true);
  expect(kill.mock.calls.filter((call: unknown[]) => call[1] === "SIGKILL")).toEqual([
    [-123, "SIGKILL"],
  ]);
});

it("keeps the slot reserved if the original process remains after bounded retries", async () => {
  vi.useFakeTimers();
  processes([1]);
  const stopping = stopOwnedProcess(123, "linux:123:1");
  await vi.advanceTimersByTimeAsync(1000);
  await expect(stopping).resolves.toBe(false);
});

it("does not terminate a PID already owned by a different process", async () => {
  const kill = processes([2]);
  await expect(stopOwnedProcess(123, "linux:123:1")).resolves.toBe(true);
  expect(kill.mock.calls).toEqual([[123, 0]]);
});
