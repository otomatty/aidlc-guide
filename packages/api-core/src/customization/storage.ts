import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { EventEmitter } from "node:events";
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { CUSTOMIZATION_LOCK_BROKER } from "./lock-broker.ts";
import { CustomizationError } from "./model.ts";

const LOCAL = "aidlc/guide-customization/.local";
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const codeOf = (error: unknown) => (error as NodeJS.ErrnoException).code;

/** The only Guide writer: confines every file and directory to clone-local storage. */
export class CustomizationStorage {
  constructor(readonly workspaceRoot: string) {}

  async path(relative: string, createParents = false): Promise<string> {
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(relative) ||
      relative.split(/[\\/]/).some((p) => p === ".." || p === ".") ||
      path.isAbsolute(relative)
    )
      throw new Error("invalid-local-path");
    const root = await realpath(this.workspaceRoot);
    const parts = [...LOCAL.split("/"), ...relative.split("/")];
    let current = root;
    for (let index = 0; index < parts.length; index++) {
      current = path.join(current, parts[index] as string);
      try {
        const info = await lstat(current);
        if (info.isSymbolicLink() || (index < parts.length - 1 && !info.isDirectory()))
          throw new Error("linked-local-path");
      } catch (error) {
        if (codeOf(error) !== "ENOENT") throw error;
        if (createParents && index < parts.length - 1)
          await mkdir(current, { mode: 0o700 }).catch((cause) => {
            if (codeOf(cause) !== "EEXIST") throw cause;
          });
        if (createParents && index < parts.length - 1) {
          const info = await lstat(current);
          if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("linked-local-path");
        }
      }
    }
    return current;
  }

  async readJson<T>(relative: string): Promise<T | null> {
    const file = await this.path(relative);
    try {
      const info = await lstat(file);
      if (!info.isFile() || info.size > 160 * 1024 * 1024) throw new Error("invalid-local-file");
      return JSON.parse(await readFile(file, "utf8")) as T;
    } catch (error) {
      if (codeOf(error) === "ENOENT") return null;
      throw error;
    }
  }

  async writeJson(relative: string, value: unknown): Promise<void> {
    const file = await this.path(relative, true);
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(value)}\n`);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await this.path(relative);
      for (let attempt = 0; ; attempt++) {
        try {
          await rename(temporary, file);
          break;
        } catch (error) {
          if (attempt > 1 || !["EPERM", "EACCES", "EBUSY"].includes(codeOf(error) ?? ""))
            throw error;
          await delay(25);
        }
      }
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }

  async withLock<T>(name: string, action: () => Promise<T>): Promise<T> {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error("invalid-lock-name");
    // The fixed file is never unlinked: the operating system releases ownership on exit.
    const lock = await this.path(`locks/${name}.lock`, true);
    // A single-line argument survives Windows quoting without Bun resolving a long data URL
    // as a filesystem path on macOS. The function body is bundled code, never workspace input.
    const program = `const Run = Object.getPrototypeOf(async function(){}).constructor; await new Run(Buffer.from('${Buffer.from(CUSTOMIZATION_LOCK_BROKER).toString("base64")}', 'base64').toString('utf8'))();`;
    const child = spawn("bun", ["--eval", program, lock], {
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    // @types/node@26 omits inherited EventEmitter methods on ChildProcess.
    const events = child as unknown as EventEmitter;
    child.stdin.on("error", () => {});
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    // Keep handling errors after acquisition removes its temporary error listener.
    // An error does not confirm exit or stdio closure; cleanup must wait for close.
    events.on("error", () => {});
    const closed = new Promise<void>((resolve) => {
      events.once("close", () => resolve());
    });
    try {
      await new Promise<void>((resolve, reject) => {
        let output = "";
        const timeout = setTimeout(() => {
          child.kill();
          reject(new Error("customization-storage-busy"));
        }, 130_000);
        const cleanup = () => {
          clearTimeout(timeout);
          events.off("error", failed);
          events.off("close", stopped);
          child.stdout.off("data", data);
        };
        const failed = (error: Error) => {
          cleanup();
          reject(error);
        };
        const stopped = (code: number | null) => {
          cleanup();
          reject(new Error(`customization-lock-exited:${code}:${stderr || output.slice(0, 40)}`));
        };
        const data = (chunk: Buffer) => {
          output += chunk.toString();
          if (output.includes("locked\n")) {
            cleanup();
            resolve();
          }
        };
        events.once("error", failed);
        events.once("close", stopped);
        child.stdout.on("data", data);
      }).catch((cause: unknown) => {
        throw new CustomizationError(
          "local-storage-unavailable",
          "下書きのロックを利用できません。Bunの実行権限と保存先を確認してください。",
          503,
          [
            {
              severity: "error",
              code: "lock-runtime-unavailable",
              message: cause instanceof Error ? cause.message : String(cause),
            },
          ],
          { cause },
        );
      });
      return await action();
    } finally {
      child.stdin.end();
      const timeout = setTimeout(() => child.kill(), 1000);
      await closed;
      clearTimeout(timeout);
    }
  }
}
