import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { CustomizationError } from "./model.ts";

/**
 * An exclusive loopback listener is a process-owned mutex shared by Node and Bun.
 * The OS releases it even after SIGKILL; no helper runtime or stale-file reaper is needed.
 * A hash collision or an unrelated listener causes contention, never unlocked work.
 */
export async function acquireLocalLock(key: string, wait: boolean): Promise<() => Promise<void>> {
  const canonical = process.platform === "win32" ? key.toLowerCase() : key;
  const port = 16384 + (createHash("sha256").update(canonical).digest().readUInt32BE(0) % 49152);
  const server = createServer((socket) => socket.destroy());
  const deadline = Date.now() + 125_000;
  for (;;) {
    try {
      await new Promise<void>((resolve, reject) => {
        const failed = (error: Error) => {
          server.off("listening", ready);
          reject(error);
        };
        const ready = () => {
          server.off("error", failed);
          resolve();
        };
        server.once("error", failed);
        server.once("listening", ready);
        server.listen({ host: "127.0.0.1", port, exclusive: true });
      });
      return () =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
      if (!wait)
        throw new CustomizationError(
          "operation-active",
          "カスタマイズを処理中です。完了してから再試行してください。",
          409,
        );
      if (Date.now() >= deadline) throw new Error("customization-storage-busy");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}
