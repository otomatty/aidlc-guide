import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireNativeWorkspaceLock } from "../src/native-workspace-lock.ts";

const faults = vi.hoisted(() => ({
  mkdir: undefined as ((file: string) => void) | undefined,
  unlink: undefined as ((file: string) => void) | undefined,
  read: undefined as ((file: string) => void) | undefined,
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    mkdirSync: (...args: Parameters<typeof actual.mkdirSync>) => {
      faults.mkdir?.(String(args[0]));
      return actual.mkdirSync(...args);
    },
    unlinkSync: (...args: Parameters<typeof actual.unlinkSync>) => {
      faults.unlink?.(String(args[0]));
      return actual.unlinkSync(...args);
    },
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      faults.read?.(String(args[0]));
      return actual.readFileSync(...args);
    },
  };
});

const roots: string[] = [];
const deadPid = 987654;
afterEach(async () => {
  faults.mkdir = undefined;
  faults.unlink = undefined;
  faults.read = undefined;
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "aidlc-workspace-lock-"));
  const resolved = realpathSync(root);
  const canonical = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  const bucket = createHash("md5").update(`${canonical}\0__workspace__`).digest("hex").slice(0, 8);
  const lock = path.join(tmpdir(), `.aidlc-audit-${bucket}.lock`);
  const gate = `${lock}.reap`;
  roots.push(root, lock, gate);
  return { root, lock, gate };
}

function stamp(directory: string, pid = deadPid, extra = {}) {
  const token = randomUUID();
  mkdirSync(directory);
  mkdirSync(path.join(directory, token));
  const bytes = JSON.stringify({
    pid,
    startedAtMs: 1,
    reapLiveOwnerAfterStale: false,
    token,
    ...extra,
  });
  writeFileSync(path.join(directory, "owner.json"), bytes);
  return { token, bytes };
}

function removeStamp(directory: string, token: string) {
  // The injected trusted recovery stands in for native's mutex-protected deletion.
  unlinkSync(path.join(directory, "owner.json"));
  rmdirSync(path.join(directory, token));
  rmdirSync(directory);
}

function markDead() {
  return vi.spyOn(process, "kill").mockImplementation((pid) => {
    if (pid === deadPid) throw Object.assign(new Error("No such process"), { code: "ESRCH" });
    return true;
  });
}

describe("native workspace lock recovery", () => {
  it.each(["lock", "gate"] as const)(
    "recovers a crashed native %s through the trusted callback before retrying",
    async (target) => {
      const { root, lock, gate } = fixture();
      const directory = target === "lock" ? lock : gate;
      const old = stamp(directory);
      markDead();
      const recoverStaleLock = vi.fn(async () => {
        expect(readFileSync(path.join(directory, "owner.json"), "utf8")).toBe(old.bytes);
        expect(existsSync(target === "lock" ? gate : lock)).toBe(false);
        removeStamp(directory, old.token);
      });

      const release = await acquireNativeWorkspaceLock(root, { recoverStaleLock });

      expect(recoverStaleLock).toHaveBeenCalledOnce();
      expect(JSON.parse(readFileSync(path.join(lock, "owner.json"), "utf8"))).toMatchObject({
        pid: process.pid,
        reapLiveOwnerAfterStale: false,
      });
      expect(existsSync(gate)).toBe(false);
      release();
      release();
      expect(existsSync(lock)).toBe(false);
    },
  );

  it("recognizes a real exited process without relying on lock age", async () => {
    const { root, lock } = fixture();
    const pid = Number(
      execFileSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"]),
    );
    const old = stamp(lock, pid, { startedAtMs: Date.now() });
    const recoverStaleLock = vi.fn(async () => removeStamp(lock, old.token));

    const release = await acquireNativeWorkspaceLock(root, { recoverStaleLock });

    expect(recoverStaleLock).toHaveBeenCalledOnce();
    release();
  });

  it.each(["lock", "gate"] as const)(
    "keeps a live old %s even if its PID generation differs",
    async (target) => {
      const { root, lock, gate } = fixture();
      const directory = target === "lock" ? lock : gate;
      const old = stamp(directory, process.pid, {
        reapLiveOwnerAfterStale: true,
        processGeneration: "old-generation-for-a-reused-pid",
      });
      const recoverStaleLock = vi.fn();

      await expect(acquireNativeWorkspaceLock(root, { recoverStaleLock })).rejects.toThrow(
        "使用中",
      );

      expect(recoverStaleLock).not.toHaveBeenCalled();
      expect(readFileSync(path.join(directory, "owner.json"), "utf8")).toBe(old.bytes);
    },
  );

  it.each(["EPERM", "EACCES", "EIO"])(
    "preserves an owner when probing returns %s",
    async (code) => {
      const { root, lock } = fixture();
      const old = stamp(lock);
      vi.spyOn(process, "kill").mockImplementation(() => {
        throw Object.assign(new Error("Process probe failed"), { code });
      });
      const recoverStaleLock = vi.fn();

      await expect(acquireNativeWorkspaceLock(root, { recoverStaleLock })).rejects.toThrow(
        "使用中",
      );

      expect(recoverStaleLock).not.toHaveBeenCalled();
      expect(readFileSync(path.join(lock, "owner.json"), "utf8")).toBe(old.bytes);
    },
  );

  it.each([
    undefined,
    "malformed owner",
    JSON.stringify({ pid: deadPid }),
    JSON.stringify({ pid: -1, token: "../outside", startedAtMs: 1 }),
  ])("preserves missing and invalid owner records: %s", async (bytes) => {
    const { root, gate } = fixture();
    mkdirSync(gate);
    if (bytes !== undefined) writeFileSync(path.join(gate, "owner.json"), bytes);
    markDead();
    const recoverStaleLock = vi.fn();

    await expect(acquireNativeWorkspaceLock(root, { recoverStaleLock })).rejects.toThrow("使用中");

    expect(recoverStaleLock).not.toHaveBeenCalled();
    expect(existsSync(gate)).toBe(true);
    if (bytes !== undefined)
      expect(readFileSync(path.join(gate, "owner.json"), "utf8")).toBe(bytes);
  });

  it("preserves an unreadable owner rather than guessing it is dead", async () => {
    const { root, gate } = fixture();
    const old = stamp(gate);
    markDead();
    const recoverStaleLock = vi.fn();
    faults.read = (file) => {
      if (file === path.join(gate, "owner.json"))
        throw Object.assign(new Error("Read denied"), { code: "EACCES" });
    };

    await expect(acquireNativeWorkspaceLock(root, { recoverStaleLock })).rejects.toThrow("使用中");

    expect(recoverStaleLock).not.toHaveBeenCalled();
    faults.read = undefined;
    expect(readFileSync(path.join(gate, "owner.json"), "utf8")).toBe(old.bytes);
  });

  it("does not recover if ownership changes during its final dead-owner check", async () => {
    const { root, gate } = fixture();
    stamp(gate);
    let probes = 0;
    const newer = JSON.stringify({
      pid: process.pid,
      token: randomUUID(),
      startedAtMs: Date.now(),
    });
    vi.spyOn(process, "kill").mockImplementation(() => {
      if (++probes === 2) writeFileSync(path.join(gate, "owner.json"), newer);
      throw Object.assign(new Error("No such process"), { code: "ESRCH" });
    });
    const recoverStaleLock = vi.fn();

    await expect(acquireNativeWorkspaceLock(root, { recoverStaleLock })).rejects.toThrow("使用中");

    expect(probes).toBe(2);
    expect(recoverStaleLock).not.toHaveBeenCalled();
    expect(readFileSync(path.join(gate, "owner.json"), "utf8")).toBe(newer);
  });

  it.each(["lock", "gate"] as const)(
    "preserves a live %s acquired while native recovery is running",
    async (target) => {
      const { root, lock, gate } = fixture();
      const directory = target === "lock" ? lock : gate;
      const old = stamp(directory);
      markDead();
      let newer = "";
      const recoverStaleLock = vi.fn(async () => {
        removeStamp(directory, old.token);
        newer = stamp(directory, process.pid).bytes;
      });

      await expect(acquireNativeWorkspaceLock(root, { recoverStaleLock })).rejects.toThrow(
        "使用中",
      );

      expect(recoverStaleLock).toHaveBeenCalledOnce();
      expect(readFileSync(path.join(directory, "owner.json"), "utf8")).toBe(newer);
    },
  );

  it("does not repeatedly run native recovery when recovery cannot clear the owner", async () => {
    const { root, lock } = fixture();
    const old = stamp(lock);
    markDead();
    const recoverStaleLock = vi.fn(async () => {});

    await expect(acquireNativeWorkspaceLock(root, { recoverStaleLock })).rejects.toThrow("使用中");

    expect(recoverStaleLock).toHaveBeenCalledOnce();
    expect(readFileSync(path.join(lock, "owner.json"), "utf8")).toBe(old.bytes);
  });

  it("cancels before reacquiring when the recovery command is cancelled", async () => {
    const { root, lock, gate } = fixture();
    const old = stamp(lock);
    markDead();
    const abort = new AbortController();
    const recoverStaleLock = vi.fn(async () => {
      removeStamp(lock, old.token);
      abort.abort();
    });

    await expect(
      acquireNativeWorkspaceLock(root, { recoverStaleLock, signal: abort.signal }),
    ).rejects.toThrow();

    expect(existsSync(lock)).toBe(false);
    expect(existsSync(gate)).toBe(false);
  });

  it("preserves a changed ownership record when release is called", async () => {
    const { root, lock } = fixture();
    const release = await acquireNativeWorkspaceLock(root);
    const newer = JSON.stringify({
      pid: process.pid,
      token: randomUUID(),
      startedAtMs: Date.now(),
    });
    writeFileSync(path.join(lock, "owner.json"), newer);

    expect(release).toThrow("所有者が変更");
    expect(readFileSync(path.join(lock, "owner.json"), "utf8")).toBe(newer);
  });

  it("retains the acquisition error if releasing the gate also fails", async () => {
    const { root, lock, gate } = fixture();
    const primary = Object.assign(new Error("Lock creation denied"), { code: "EACCES" });
    const secondary = new Error("Gate cleanup failed");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    faults.mkdir = (file) => {
      if (file === lock) throw primary;
    };
    faults.unlink = (file) => {
      if (file === path.join(gate, "owner.json")) throw secondary;
    };

    await expect(acquireNativeWorkspaceLock(root)).rejects.toBe(primary);

    expect(log).toHaveBeenCalledWith(expect.any(String), secondary);
    expect(existsSync(lock)).toBe(false);
  });

  it("releases the workspace lock if releasing its acquisition gate fails", async () => {
    const { root, lock, gate } = fixture();
    const secondary = new Error("Gate cleanup failed");
    faults.unlink = (file) => {
      if (file === path.join(gate, "owner.json")) throw secondary;
    };

    await expect(acquireNativeWorkspaceLock(root)).rejects.toBe(secondary);

    expect(existsSync(lock)).toBe(false);
  });

  it("records a release failure without replacing the transaction failure", async () => {
    const { root, lock } = fixture();
    const release = await acquireNativeWorkspaceLock(root);
    const primary = new Error("Transaction failed");
    const secondary = new Error("Lock cleanup failed");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    faults.unlink = (file) => {
      if (file === path.join(lock, "owner.json")) throw secondary;
    };

    expect(() => release({ error: primary })).not.toThrow();
    expect(log).toHaveBeenCalledWith(expect.any(String), secondary);
  });
});
