import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Bridge, createBridge } from "@aidlc-guide/docs-bridge";
import { createReader, type Reader, resolveRecordDir } from "@aidlc-guide/reader-core";
import type { Matrix, ReadResult, ServeOptions } from "@aidlc-guide/shared-types";
import { handleAnswer } from "./handlers/answer-writer.ts";
import { handleRead } from "./handlers/read.ts";
import { createHub } from "./push.ts";
import { createStatic } from "./static.ts";

/** Bun.serve setup and the startup sequence (business-logic-model.md 起動シーケンス). */

export const DEFAULT_PORT = 4700;
const LOOPBACK = "127.0.0.1";
const ALL_INTERFACES = "0.0.0.0";
const WS_ROUTE = "/ws";

/**
 * US-19 acceptance text. A constant so the wording is asserted by test rather
 * than retyped — the point of the warning is that it names *what* is exposed,
 * not merely that a port opened (S-DS-1).
 */
export const HOST_EXPOSURE_WARNING =
  "警告: LAN に公開します。レンダリングされた aidlc 成果物・監査内容" +
  "（ユーザーが貼り付けた秘密を含み得る）が同一ネットワークの全端末から閲覧可能になります。" +
  "また --host 中は回答の書き込みが全クライアントで無効になります（read-only mode）。";

export const DIST_MISSING_HINT =
  "packages/dashboard/dist/ が見つかりません。先に dashboard のビルドを実行してください。" +
  "今回は API のみのモードで起動します（UI は配信されません）。";

const here = path.dirname(fileURLToPath(import.meta.url));

/** `packages/dashboard/dist` relative to this file — the sibling UI package. */
export const DEFAULT_DIST_DIR = path.resolve(here, "..", "..", "dashboard", "dist");

export interface ServeConfig extends ServeOptions {
  /** Workspace whose `aidlc/` tree is read. Defaults to the process cwd. */
  workspaceRoot?: string;
  /** Built SPA directory. Configurable so this unit is runnable before the UI exists. */
  distDir?: string;
  /** Pin the record instead of resolving the active-intent cursor (tests). */
  recordDir?: string;
  /** Watch debounce; forwarded to reader-core. */
  debounceMs?: number;
}

export interface RunningServer {
  port: number;
  hostname: string;
  /** `true` when `dist/` was absent and only the API is being served. */
  apiOnly: boolean;
  reader: Reader;
  bridge: Bridge;
  stop(): Promise<void>;
}

export async function serve(config: ServeConfig): Promise<RunningServer> {
  const workspaceRoot = config.workspaceRoot ?? process.cwd();
  const distDir = config.distDir ?? DEFAULT_DIST_DIR;

  // 1. dist check. The design calls for fail-fast here; until the dashboard
  //    package ships there is nothing to build, so absence degrades to
  //    API-only instead (code-summary.md D-1).
  const distPresent = existsSync(path.join(distDir, "index.html"));

  // 2. Instances. Neither touches the filesystem at construction (P-DS-1).
  const reader = createReader(workspaceRoot, {
    ...(config.recordDir === undefined ? {} : { recordDir: config.recordDir }),
  });
  const bridge = createBridge();
  const statics = createStatic(distDir, distPresent);

  const recordDir = async (): Promise<ReadResult<string>> =>
    config.recordDir === undefined
      ? await resolveRecordDir(workspaceRoot)
      : { ok: true, value: config.recordDir };

  const hub = createHub({ reader, recordDir });
  let matrixCache: ReadResult<Matrix> | null = null;

  const readContext = {
    reader,
    bridge,
    hostMode: config.host,
    recordDir,
    matrix: () => matrixCache,
  };
  const answerContext = { hostMode: config.host, recordDir };

  const route = async (url: URL, request: Request): Promise<Response> => {
    if (request.method === "POST") {
      if (url.pathname === "/api/answer") return await handleAnswer(answerContext, request);
      return new Response("method not allowed", { status: 405 });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", { status: 405 });
    }
    const api = await handleRead(readContext, url);
    if (api !== null) return api;
    return (await statics.handle(url.pathname)) ?? new Response("not found", { status: 404 });
  };

  // 3./4. Bind and listen. A bind failure throws out of here and is fatal —
  //       silently falling back to loopback would contradict the operator's
  //       explicit `--host` (BR-DS-2).
  const server = Bun.serve({
    port: config.port,
    hostname: config.host ? ALL_INTERFACES : LOOPBACK,

    fetch(request, self) {
      const url = new URL(request.url);
      if (url.pathname === WS_ROUTE) {
        if (self.upgrade(request)) return undefined;
        return new Response("expected a websocket upgrade", { status: 400 });
      }
      return route(url, request);
    },

    websocket: {
      open(ws) {
        // No snapshot on connect: the client has already fetched initial state
        // over REST and the socket carries deltas only.
        hub.add(ws);
      },
      close(ws) {
        hub.remove(ws);
      },
      message() {
        // S-DS-6: push-only. Inbound frames are dropped without being logged,
        // so a chatty or hostile client cannot inflate the log.
      },
    },
  });

  // 5. Stage 2: the full scan runs in the background so it is never on the
  //    first-paint path (ADR-03). Completion is pushed, not polled.
  queueMicrotask(() => {
    void reader.getMatrix().then((result) => {
      matrixCache = result;
      if ("ok" in result) hub.broadcast({ type: "matrix-ready", matrix: result.value });
    });
  });

  // 6. Live updates.
  const unwatch = reader.watch(
    (event) => {
      void hub.handleWatchEvent(event);
    },
    config.debounceMs === undefined ? {} : { debounceMs: config.debounceMs },
  );

  // Bun types these as optional because a unix-socket server has neither; we
  // always bind TCP, so absence would be a Bun-contract break worth failing on.
  if (server.port === undefined || server.hostname === undefined) {
    await server.stop(true);
    throw new Error("Bun.serve did not report a TCP address");
  }

  return {
    port: server.port,
    hostname: server.hostname,
    apiOnly: !distPresent,
    reader,
    bridge,
    async stop() {
      unwatch();
      await server.stop(true);
    },
  };
}
