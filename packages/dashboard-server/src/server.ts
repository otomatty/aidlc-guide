import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGuideService, handleAnswer, handleRead } from "@aidlc-guide/api-core";
import type { Bridge } from "@aidlc-guide/docs-bridge";
import type { Reader } from "@aidlc-guide/reader-core";
import type { ServeOptions } from "@aidlc-guide/shared-types";
import { createStatic } from "./static.ts";

/** Bun.serve setup and the startup sequence (business-logic-model.md 起動シーケンス). */

export const DEFAULT_PORT = 4700;
const LOOPBACK = "127.0.0.1";
const ALL_INTERFACES = "0.0.0.0";
const WS_ROUTE = "/ws";

// Re-exported from api-core (its doc explains why it lives there); existing
// consumers and the S-MM-2 one-wording assertion keep this import site.
export { HOST_EXPOSURE_WARNING } from "@aidlc-guide/api-core";

export const DIST_MISSING_HINT =
  "packages/dashboard/dist/ が見つかりません。先に dashboard のビルドを実行してください。" +
  "今回は API のみのモードで起動します（UI は配信されません）。";

const here = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_DIST_DIR = path.resolve(here, "..", "..", "dashboard", "dist");

export interface ServeConfig extends ServeOptions {
  workspaceRoot?: string;
  distDir?: string;
  recordDir?: string;
  debounceMs?: number;
}

export interface RunningServer {
  port: number;
  hostname: string;
  apiOnly: boolean;
  reader: Reader;
  bridge: Bridge;
  stop(): Promise<void>;
}

export async function serve(config: ServeConfig): Promise<RunningServer> {
  const workspaceRoot = config.workspaceRoot ?? process.cwd();
  const distDir = config.distDir ?? DEFAULT_DIST_DIR;

  const distPresent = existsSync(path.join(distDir, "index.html"));

  const service = createGuideService({
    workspaceRoot,
    hostMode: config.host,
    ...(config.recordDir === undefined ? {} : { recordDir: config.recordDir }),
    ...(config.debounceMs === undefined ? {} : { debounceMs: config.debounceMs }),
  });
  const statics = createStatic(distDir, distPresent);

  const route = async (url: URL, request: Request): Promise<Response> => {
    if (request.method === "POST") {
      if (url.pathname === "/api/answer") {
        return await handleAnswer(service.answerContext, request);
      }
      return new Response("method not allowed", { status: 405 });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", { status: 405 });
    }
    const api = await handleRead(service.readContext, url);
    if (api !== null) return api;
    return (await statics.handle(url.pathname)) ?? new Response("not found", { status: 404 });
  };

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
        service.hub.add(ws);
      },
      close(ws) {
        service.hub.remove(ws);
      },
      message() {},
    },
  });

  service.startMatrixBackground();
  const unwatch = service.startWatch();

  if (server.port === undefined || server.hostname === undefined) {
    await server.stop(true);
    throw new Error("Bun.serve did not report a TCP address");
  }

  return {
    port: server.port,
    hostname: server.hostname,
    apiOnly: !distPresent,
    reader: service.reader,
    bridge: service.bridge,
    async stop() {
      unwatch();
      await server.stop(true);
    },
  };
}
