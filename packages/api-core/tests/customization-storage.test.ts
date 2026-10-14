import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { CustomizationStorage } from "../src/customization/storage";

vi.mock("node:net", async (original) => ({ ...await original<typeof import("node:net")>(), createServer: vi.fn((...args: Parameters<typeof createServer>) => actualCreateServer(...args)) }));
const { createServer: actualCreateServer } = await vi.importActual<typeof import("node:net")>("node:net");
afterEach(() => { vi.unstubAllEnvs(); vi.mocked(createServer).mockImplementation((...args) => actualCreateServer(...args)); });

it("retains acquisition errors without running an unlocked mutation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "customization-lock-error-"));
  const cause = Object.assign(new Error("listen permission denied"), { code: "EACCES" });
  vi.mocked(createServer).mockImplementation(() => { throw cause; });
  try {
    const action = vi.fn();
    await expect(new CustomizationStorage(root).withLock("draft", action)).rejects.toMatchObject({
      code: "local-storage-unavailable", status: 503, cause,
      diagnostics: [{ code: "lock-runtime-unavailable", message: cause.message }],
    });
    expect(action).not.toHaveBeenCalled();
  } finally { await rm(root, { recursive: true, force: true }); }
});

it("locks without Bun and releases after an action throws", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "customization-lock-node-"));
  for (const key of Object.keys(process.env).filter((key) => key.toLowerCase() === "path")) vi.stubEnv(key, "");
  const first = new CustomizationStorage(root);
  const second = new CustomizationStorage(root);
  const actionError = new Error("action failed");
  try {
    await expect(first.withLock("apply", async () => {
      const action = vi.fn();
      await expect(second.withLock("apply", action, { wait: false })).rejects.toMatchObject({ code: "operation-active", status: 409 });
      expect(action).not.toHaveBeenCalled();
      throw actionError;
    })).rejects.toBe(actionError);
    await expect(second.withLock("apply", async () => "acquired", { wait: false })).resolves.toBe("acquired");
  } finally { await rm(root, { recursive: true, force: true }); }
});
