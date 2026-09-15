import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** null means absent. Unverifiable identities throw; they never release a job slot. */
export async function processIdentity(pid: number): Promise<string | null> {
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("invalid-process-id");
  try {
    process.kill(pid, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return null;
    throw new Error("process-identity-unavailable");
  }
  if (process.platform === "linux") {
    try {
      const stat = await readFile(`/proc/${pid}/stat`, "utf8");
      const start = stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19];
      if (!start) throw new Error("process-identity-unavailable");
      return `linux:${pid}:${start}`;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  const options = { timeout: 5_000, maxBuffer: 4096, windowsHide: true };
  if (process.platform === "win32") {
    const { stdout } = await exec(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($p) { $p.StartTime.ToUniversalTime().Ticks } else { 'absent' }`,
      ],
      options,
    );
    const value = stdout.trim();
    if (value === "absent") return null;
    if (!/^\d+$/.test(value)) throw new Error("process-identity-unavailable");
    return `windows:${pid}:${value}`;
  }
  const { stdout } = await exec("ps", ["-o", "lstart=", "-p", String(pid)], options);
  if (!stdout.trim()) return null;
  return `unix:${pid}:${stdout.trim()}`;
}

/** Only a durably recorded, identity-matched child may be terminated during recovery. */
export async function stopOwnedProcess(pid: number, identity: string): Promise<boolean> {
  const current = await processIdentity(pid);
  if (current === null || current !== identity) return true;
  if (process.platform === "win32") {
    await exec("taskkill", ["/PID", String(pid), "/T", "/F"], {
      timeout: 10_000,
      windowsHide: true,
      maxBuffer: 4096,
    });
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      if ((await processIdentity(pid)) === identity) process.kill(pid, "SIGKILL");
    }
  }
  const after = await processIdentity(pid);
  return after === null || after !== identity;
}
