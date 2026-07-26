import { type ChildProcess, spawn } from "node:child_process";
import type { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { WsMessage } from "@aidlc-guide/shared-types";
import { afterEach, describe, expect, it } from "vitest";
import { EXPOSURE_ADDRESS_HEADING, EXPOSURE_NO_ADDRESS_HINT } from "../src/exposure-notice.ts";
import { DEFAULT_DIST_DIR, DIST_MISSING_HINT, HOST_EXPOSURE_WARNING } from "../src/server.ts";
import { CLI, STATE_MD, seedWorkspace } from "./support.ts";

/** @types/node@26 ChildProcess class omits EventEmitter methods; restore them. */
function processEvents(child: ChildProcess): EventEmitter {
  return child as unknown as EventEmitter;
}

/**
 * End-to-end against a **real** `Bun.serve` on port 0.
 *
 * Vitest runs under Node here, where `Bun.serve` does not exist, so the server
 * is spawned as a child Bun process and driven over real HTTP and a real
 * WebSocket. This is the only test that exercises server.ts / cli.ts wiring —
 * both are excluded from coverage for exactly that reason (vitest.config.ts).
 */

const BUN = process.platform === "win32" ? "bun.exe" : "bun";
// Anchored on the ready line's own prefix: `--host` also prints a list of LAN
// URLs above it (mob-mode M1), and a bare `http://…` match would pick one of
// those up and report a NIC address as the bind address.
const READY = /AIDLC Guide dashboard: http:\/\/([\d.]+):(\d+)/;
const TIMEOUT = 30_000;

interface Running {
  origin: string;
  hostname: string;
  stdout: string;
  child: ChildProcess;
}

const running: ChildProcess[] = [];

afterEach(() => {
  for (const child of running.splice(0)) child.kill();
});

function start(args: readonly string[], cwd: string): Promise<Running> {
  return new Promise((resolve, reject) => {
    const child = spawn(BUN, [CLI, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    running.push(child);

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(
      () => reject(new Error(`no ready line. out=${stdout} err=${stderr}`)),
      TIMEOUT - 5_000,
    );

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      const match = READY.exec(stdout);
      if (match?.[1] === undefined || match[2] === undefined) return;
      clearTimeout(timer);
      // Always talk to loopback even when the server bound 0.0.0.0.
      resolve({ origin: `http://127.0.0.1:${match[2]}`, hostname: match[1], stdout, child });
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    processEvents(child).on("error", reject);
    processEvents(child).on("exit", (code: number | null) => {
      clearTimeout(timer);
      reject(new Error(`server exited early (${code}). out=${stdout} err=${stderr}`));
    });
  });
}

/** Collect pushes until `match` is satisfied, then resolve with everything seen. */
function collect(origin: string, match: (m: WsMessage) => boolean): Promise<WsMessage[]> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${origin.replace("http", "ws")}/ws`);
    const seen: WsMessage[] = [];
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`no matching push. saw ${JSON.stringify(seen)}`));
    }, TIMEOUT - 5_000);

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as WsMessage;
      seen.push(message);
      if (!match(message)) return;
      clearTimeout(timer);
      socket.close();
      resolve(seen);
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("websocket error"));
    });
  });
}

function open(origin: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${origin.replace("http", "ws")}/ws`);
    socket.addEventListener("open", () => resolve(socket));
    socket.addEventListener("error", () => reject(new Error("websocket error")));
  });
}

describe("bind and startup", () => {
  it(
    "defaults to loopback and answers /api/workflow without a matrix (S-DS-1, ADR-03)",
    async () => {
      const { root } = await seedWorkspace();
      const server = await start(["--port", "0"], root);

      expect(server.hostname).toBe("127.0.0.1");
      // The dashboard package now exists, so whether this run is API-only
      // depends on whether `bun run build:dashboard` has been run in this
      // checkout. Assert the branch rather than one side of it — the API
      // contract below is identical either way.
      const apiOnly = !existsSync(path.join(DEFAULT_DIST_DIR, "index.html"));
      expect(server.stdout.includes(DIST_MISSING_HINT)).toBe(apiOnly);

      const body = (await (await fetch(`${server.origin}/api/workflow`)).json()) as Record<
        string,
        unknown
      >;
      expect(body.serverMode).toEqual({ hostMode: false });
      expect(body.workflow).toMatchObject({ currentStage: "functional-design" });
      expect(body).not.toHaveProperty("matrix");
    },
    TIMEOUT,
  );

  it(
    "--host prints the exposure warning naming what becomes visible (US-19)",
    async () => {
      const { root } = await seedWorkspace();
      const server = await start(["--port", "0", "--host"], root);

      expect(server.stdout).toContain(HOST_EXPOSURE_WARNING);
      expect(server.hostname).toBe("0.0.0.0");
      // BR-MM-2 / S-MM-2: the warning names *what* becomes visible.
      for (const word of ["成果物", "監査", "秘密", "read-only"]) {
        expect(HOST_EXPOSURE_WARNING).toContain(word);
      }

      // mob-mode M1: the URLs to hand to participants are printed with the
      // warning. The list is legitimately empty on a machine with no external
      // NIC, and R-MM-2 says the heading is then suppressed rather than left
      // dangling — so assert the two states, not one machine's network.
      const at = server.stdout.indexOf(EXPOSURE_ADDRESS_HEADING);
      // The warning always comes first: an operator about to paste a URL into
      // a group chat reads what they are exposing before they see the URL.
      expect(server.stdout.indexOf(HOST_EXPOSURE_WARNING)).toBeLessThan(
        at === -1 ? server.stdout.length : at,
      );
      if (at === -1) {
        // No external NIC — a hint instead of a heading over an empty list.
        expect(server.stdout).toContain(EXPOSURE_NO_ADDRESS_HINT);
      } else {
        const listed = server.stdout
          .slice(at)
          .split("\n")
          .slice(1)
          .filter((line) => line.startsWith("  "));
        expect(listed.length).toBeGreaterThan(0);
        // S-MM-4: IPv4 and a port, nothing else.
        for (const line of listed) {
          expect(line.trim()).toMatch(/^http:\/\/\d{1,3}(\.\d{1,3}){3}:\d+$/);
        }
      }
    },
    TIMEOUT,
  );

  it(
    "makes a bind failure fatal instead of falling back to loopback (R-MM-1 / BR-MM-5)",
    async () => {
      const { root } = await seedWorkspace();
      // Take a real port with a real server, then ask a second one for it.
      const holder = await start(["--port", "0", "--host"], root);
      const port = new URL(holder.origin).port;

      const second = await new Promise<{ code: number | null; out: string; err: string }>(
        (resolve, reject) => {
          const child = spawn(BUN, [CLI, "--port", port, "--host"], {
            cwd: root,
            stdio: ["ignore", "pipe", "pipe"],
          });
          running.push(child);
          let out = "";
          let err = "";
          child.stdout?.on("data", (chunk: Buffer) => {
            out += chunk.toString();
          });
          child.stderr?.on("data", (chunk: Buffer) => {
            err += chunk.toString();
          });
          processEvents(child).on("error", reject);
          processEvents(child).on("exit", (code: number | null) => resolve({ code, out, err }));
        },
      );

      expect(second.code).not.toBe(0);
      // The operator is told why and what to do, on stderr.
      expect(second.err).toMatch(/EADDRINUSE|address already in use|port \d+ in use/i);
      expect(second.err).toContain("使用中");
      expect(second.err).toContain("--port");
      // And it did NOT quietly serve something: no ready line, and in
      // particular no loopback ready line masquerading as the --host they asked
      // for (BR-MM-5 — never silently narrow *or* widen the exposure).
      expect(second.out).not.toMatch(READY);
      // The first server is untouched and still answering.
      expect((await fetch(`${holder.origin}/api/workflow`)).status).toBe(200);
    },
    TIMEOUT,
  );

  it(
    "--host refuses a direct POST /api/answer that bypasses the UI (S-DS-2)",
    async () => {
      const { root, recordDir } = await seedWorkspace();
      await writeFile(path.join(recordDir, "a-questions.md"), "# Q\n[Answer]: \n");
      const server = await start(["--port", "0", "--host"], root);

      const response = await fetch(`${server.origin}/api/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file: "a-questions.md", line: 2, value: "sneaky" }),
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: "read-only-mode" });
      // And the file is untouched.
      const after = await (await fetch(`${server.origin}/api/artifact?path=a-questions.md`)).json();
      expect(JSON.stringify(after)).toContain("[Answer]: ");
      expect(JSON.stringify(after)).not.toContain("sneaky");
    },
    TIMEOUT,
  );

  it(
    "reports hostMode over the wire so the client can hide the editor",
    async () => {
      const { root } = await seedWorkspace();
      const server = await start(["--port", "0", "--host"], root);
      const body = (await (await fetch(`${server.origin}/api/workflow`)).json()) as {
        serverMode: { hostMode: boolean };
      };
      expect(body.serverMode.hostMode).toBe(true);
    },
    TIMEOUT,
  );
});

describe("write path end to end (US-14)", () => {
  it(
    "accepts an answer on loopback and leaves the rest of the file intact",
    async () => {
      const { root, recordDir } = await seedWorkspace();
      const questions = path.join(recordDir, "a-questions.md");
      await writeFile(questions, "# Q1\n[Answer]: \n\n# Q2\n[Answer]: keep\n");
      const server = await start(["--port", "0"], root);

      const response = await fetch(`${server.origin}/api/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file: "a-questions.md", line: 2, value: "bun" }),
      });

      expect(response.status).toBe(200);
      const body = (await (
        await fetch(`${server.origin}/api/artifact?path=a-questions.md`)
      ).json()) as { value: string };
      expect(body.value).toBe("# Q1\n[Answer]: bun\n\n# Q2\n[Answer]: keep\n");
    },
    TIMEOUT,
  );
});

describe("websocket push (FR-7.2 / BR-DS-6)", () => {
  it(
    "delivers the identical payload to two connected clients and ignores inbound frames",
    async () => {
      const { root, recordDir } = await seedWorkspace();
      const server = await start(["--port", "0"], root);

      // Both clients must be connected before the change is made.
      const [a, b] = await Promise.all([open(server.origin), open(server.origin)]);
      const isState = (m: WsMessage): boolean => m.type === "change" && m.scope === "state";
      const waitA = new Promise<string>((resolve) =>
        a.addEventListener("message", (event) => {
          if (isState(JSON.parse(String(event.data)) as WsMessage)) resolve(String(event.data));
        }),
      );
      const waitB = new Promise<string>((resolve) =>
        b.addEventListener("message", (event) => {
          if (isState(JSON.parse(String(event.data)) as WsMessage)) resolve(String(event.data));
        }),
      );

      // S-DS-6: the server defines no inbound protocol; this must be dropped
      // rather than crash the connection or the process.
      a.send(JSON.stringify({ type: "write", evil: true }));
      a.send("not even json");

      // The child subscribes its watcher just after it prints the ready line,
      // so a single write can land before chokidar is listening. Re-apply the
      // same change until it is observed — the content is identical every time,
      // so extra events cannot change what the clients are asserted on.
      const both = Promise.all([waitA, waitB]);
      let settled = false;
      void both.then(() => {
        settled = true;
      });
      const trigger = setInterval(() => {
        if (settled) return;
        void writeFile(
          path.join(recordDir, "aidlc-state.md"),
          STATE_MD.replace("**Completed**: 1", "**Completed**: 2"),
        );
      }, 400);

      const [rawA, rawB] = await both.finally(() => clearInterval(trigger));
      expect(rawA).toBe(rawB);
      const message = JSON.parse(rawA) as Extract<WsMessage, { scope: "state" }>;
      expect(message.workflow.done).toBe(2);
      expect(message.nextStep.nextStage).toBe("code-generation");

      a.close();
      b.close();
      // The server survived the junk frames.
      expect((await fetch(`${server.origin}/api/workflow`)).status).toBe(200);
    },
    TIMEOUT,
  );

  it(
    "builds the matrix in the background and announces it with matrix-ready",
    async () => {
      const { root } = await seedWorkspace();
      const server = await start(["--port", "0"], root);
      // Either the push arrives, or the scan already finished — both prove the
      // stage-2 build ran off the first-paint path.
      const settled = await Promise.race([
        collect(server.origin, (m) => m.type === "matrix-ready").then(() => "pushed"),
        (async () => {
          for (let i = 0; i < 40; i += 1) {
            const body = (await (await fetch(`${server.origin}/api/matrix`)).json()) as {
              building?: boolean;
            };
            if (body.building !== true) return "cached";
            await new Promise((r) => setTimeout(r, 100));
          }
          return "never";
        })(),
      ]);
      expect(settled).not.toBe("never");
    },
    TIMEOUT,
  );
});
