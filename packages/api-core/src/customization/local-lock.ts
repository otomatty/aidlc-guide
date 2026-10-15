import { createHash } from "node:crypto";
import { createServer, type Server } from "node:net";
import { CustomizationError } from "./model.ts";

/**
 * An exclusive loopback listener is a process-owned mutex shared by Node and Bun.
 * The OS releases it even after SIGKILL; no helper runtime or stale-file reaper is needed.
 * A hash collision or an unrelated listener causes contention, never unlocked work.
 *
 * Windows reserves loopback port ranges (Hyper-V, WinNAT, WSL, Docker) and refuses a
 * listen inside one with EACCES, so a single derived port could make a workspace
 * permanently unlockable. Each key therefore has a few candidate ports, and a holder
 * binds every candidate it is allowed to. Any candidate already bound is contention.
 * Two processes exclude each other whenever the ports they could bind overlap, even if
 * a reserved range appeared or vanished between their attempts.
 */
const CANDIDATES = 4;

/**
 * The first candidate is the single port older releases used, so a mixed-version
 * pair excludes each other whenever that port is bindable. Older releases only ever
 * bind that one port, so nothing here can stop one from taking it if it was reserved
 * when this process acquired the lock and the reservation lifts mid-operation. While
 * it stays reserved, an older release cannot lock that workspace at all.
 */
export function localLockPorts(key: string): number[] {
  const canonical = process.platform === "win32" ? key.toLowerCase() : key;
  const ports = Array.from({ length: CANDIDATES }, (_, slot) => {
    const seed = slot === 0 ? canonical : `${canonical}\0${slot}`;
    return 16384 + (createHash("sha256").update(seed).digest().readUInt32BE(0) % 49152);
  });
  // Binding one port twice from this process would contend with itself.
  return [...new Set(ports)];
}

function bind(port: number): Promise<Server> {
  const server = createServer((socket) => socket.destroy());
  return new Promise<Server>((resolve, reject) => {
    const failed = (error: Error) => {
      server.off("listening", ready);
      reject(error);
    };
    const ready = () => {
      server.off("error", failed);
      resolve(server);
    };
    server.once("error", failed);
    server.once("listening", ready);
    server.listen({ host: "127.0.0.1", port, exclusive: true });
  });
}

function closeAll(servers: Server[]): Promise<void> {
  return Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  ).then(() => undefined);
}

const errorCode = (error: unknown) => (error as NodeJS.ErrnoException).code;

export async function acquireLocalLock(key: string, wait: boolean): Promise<() => Promise<void>> {
  const ports = localLockPorts(key);
  const deadline = Date.now() + 125_000;
  for (;;) {
    const held: Server[] = [];
    let reserved: unknown;
    try {
      for (const port of ports) {
        try {
          held.push(await bind(port));
        } catch (error) {
          if (errorCode(error) !== "EACCES") throw error;
          reserved = error;
        }
      }
    } catch (error) {
      await closeAll(held);
      if (errorCode(error) !== "EADDRINUSE") throw error;
      if (!wait)
        throw new CustomizationError(
          "operation-active",
          "カスタマイズを処理中です。完了してから再試行してください。",
          409,
        );
      if (Date.now() >= deadline) throw new Error("customization-storage-busy");
      await new Promise((resolve) => setTimeout(resolve, 20));
      continue;
    }
    if (held.length === 0) throw reserved;
    return () => closeAll(held);
  }
}
