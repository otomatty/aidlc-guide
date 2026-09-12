import { createHash, randomUUID } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type Failure = { error: unknown };
type Release = (primary?: Failure) => void;
type Owner = {
  pid: number;
  startedAtMs: number;
  reapLiveOwnerAfterStale: boolean;
  token: string;
};
type DeadOwner = { directory: string; bytes: Buffer; identity: string };

export type NativeWorkspaceLockOptions = {
  /** The retained native CLI owns recovery, including its OS-level gate mutex. */
  recoverStaleLock?: () => Promise<void>;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
};

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class WorkspaceBusy extends Error {
  constructor(
    cause: unknown,
    readonly deadOwner: DeadOwner | null,
  ) {
    super("このプロジェクトは別の処理で使用中です。完了後に再実行してください。", { cause });
  }
}

function recordCleanupFailure(cleanup: unknown): void {
  try {
    console.error("AI-DLC: 設定ロックの後処理に失敗しました。", cleanup);
  } catch {
    // Diagnostic output must never replace the operation's original failure.
  }
}

function directoryIdentity(directory: string): string {
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Invalid lock directory");
  return `${stat.dev}\0${stat.ino}\0${stat.birthtimeMs}`;
}

/** Only ESRCH proves death. A reused, inaccessible, or unknown PID stays protected. */
function inspectDeadOwner(directory: string): DeadOwner | null {
  try {
    const identity = directoryIdentity(directory);
    const file = path.join(directory, "owner.json");
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    const bytes = readFileSync(file);
    const owner: unknown = JSON.parse(bytes.toString("utf8"));
    if (owner === null || typeof owner !== "object") return null;
    const { pid, startedAtMs, token } = owner as Partial<Owner>;
    if (
      !Number.isInteger(pid) ||
      typeof pid !== "number" ||
      pid <= 0 ||
      typeof startedAtMs !== "number" ||
      !Number.isFinite(startedAtMs) ||
      typeof token !== "string" ||
      !TOKEN.test(token)
    )
      return null;
    directoryIdentity(path.join(directory, token));
    try {
      process.kill(pid, 0);
      return null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "ESRCH") return null;
    }
    // Ownership can change while the process is being probed.
    if (directoryIdentity(directory) !== identity || !readFileSync(file).equals(bytes)) return null;
    return { directory, bytes, identity };
  } catch {
    // Invalid, missing, and unreadable stamps are not evidence of a dead owner.
    return null;
  }
}

function stillDead(owner: DeadOwner): boolean {
  const current = inspectDeadOwner(owner.directory);
  return (
    current !== null && current.identity === owner.identity && current.bytes.equals(owner.bytes)
  );
}

function ownLock(directory: string): Release {
  try {
    mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "EEXIST")
      throw new WorkspaceBusy(error, inspectDeadOwner(directory));
    throw error;
  }
  const token = randomUUID();
  const owner: Owner = {
    pid: process.pid,
    startedAtMs: Date.now(),
    reapLiveOwnerAfterStale: false,
    token,
  };
  const bytes = Buffer.from(JSON.stringify(owner));
  let identity: string;
  try {
    identity = directoryIdentity(directory);
    mkdirSync(path.join(directory, token), { mode: 0o700 });
    writeFileSync(path.join(directory, "owner.json"), bytes, { flag: "wx", mode: 0o600 });
  } catch (error) {
    try {
      rmdirSync(path.join(directory, token));
    } catch {
      /* Never recursively remove a lock. */
    }
    try {
      rmdirSync(directory);
    } catch (cleanup) {
      recordCleanupFailure(cleanup);
    }
    throw error;
  }
  let released = false;
  return (primary) => {
    if (released) return;
    try {
      // Live owners cannot be reaped by native recovery. Verify the entire generation.
      if (
        directoryIdentity(directory) !== identity ||
        !readFileSync(path.join(directory, "owner.json")).equals(bytes)
      )
        throw new Error("設定ロックの所有者が変更されました。");
      directoryIdentity(path.join(directory, token));
      unlinkSync(path.join(directory, "owner.json"));
      rmdirSync(path.join(directory, token));
      rmdirSync(directory);
      released = true;
    } catch (cleanup) {
      if (!primary) throw cleanup;
      recordCleanupFailure(cleanup);
    }
  };
}

function acquire(lock: string): Release {
  const releaseGate = ownLock(`${lock}.reap`);
  let releaseLock: Release | undefined;
  let failure: Failure | undefined;
  try {
    try {
      releaseLock = ownLock(lock);
    } catch (error) {
      failure = { error };
      throw error;
    } finally {
      releaseGate(failure);
    }
    return releaseLock;
  } catch (error) {
    // If releasing the gate failed after acquisition, do not leak the workspace lock.
    releaseLock?.({ error });
    throw error;
  }
}

/** Acquire the native workspace bucket, recovering a crashed owner at most once. */
export async function acquireNativeWorkspaceLock(
  root: string,
  options: NativeWorkspaceLockOptions = {},
): Promise<Release> {
  const checkCurrent = () => {
    options.signal?.throwIfAborted();
    if (options.isCurrent?.() === false) throw new Error("プロジェクトの設定を中止しました。");
  };
  checkCurrent();
  const resolved = realpathSync(root);
  const canonical = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  const bucket = createHash("md5").update(`${canonical}\0__workspace__`).digest("hex").slice(0, 8);
  const lock = path.join(tmpdir(), `.aidlc-audit-${bucket}.lock`);
  try {
    return acquire(lock);
  } catch (error) {
    if (
      !(error instanceof WorkspaceBusy) ||
      !error.deadOwner ||
      !options.recoverStaleLock ||
      !stillDead(error.deadOwner)
    )
      throw error;
    checkCurrent();
    // Node cannot take native's flock / LockFileEx gate mutex. Do not rename or
    // delete another generation here: doctor rechecks ownership under that mutex.
    await options.recoverStaleLock();
    checkCurrent();
    return acquire(lock);
  }
}
