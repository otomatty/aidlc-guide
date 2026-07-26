import type { WsMessage } from "@aidlc-guide/shared-types";
import type { SubscribeOptions, Transport } from "./types.ts";

interface VsCodeApi {
  postMessage(message: unknown): void;
}

type PendingGet = (result: { reached: true; body: unknown } | { reached: false }) => void;
type PendingPost = (result: { ok: boolean; status: number; body: unknown }) => void;

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

/**
 * VS Code webview transport — all I/O goes through the extension host, which
 * runs api-core directly (no HTTP port in the IDE path).
 */
export function createVscodeTransport(): Transport {
  const vscode = window.acquireVsCodeApi?.();
  if (vscode === undefined) {
    throw new Error("acquireVsCodeApi is not available");
  }

  const pendingGet = new Map<string, PendingGet>();
  const pendingPost = new Map<string, PendingPost>();
  const pushHandlers = new Set<SubscribeOptions>();

  window.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as Record<string, unknown>;
    if (typeof data !== "object" || data === null) return;

    if (data.type === "get-response" && typeof data.id === "string") {
      const resolve = pendingGet.get(data.id);
      if (resolve === undefined) return;
      pendingGet.delete(data.id);
      if (data.reached === true) {
        resolve({ reached: true, body: data.body });
      } else {
        resolve({ reached: false });
      }
      return;
    }

    if (data.type === "post-response" && typeof data.id === "string") {
      const resolve = pendingPost.get(data.id);
      if (resolve === undefined) return;
      pendingPost.delete(data.id);
      resolve({
        ok: data.ok === true,
        status: typeof data.status === "number" ? data.status : 0,
        body: data.body,
      });
      return;
    }

    if (data.type === "push" && data.message !== undefined) {
      const message = data.message as WsMessage;
      for (const handler of pushHandlers) {
        handler.onMessage(message);
      }
    }

    if (data.type === "connected") {
      for (const handler of pushHandlers) {
        handler.onConnect();
      }
    }
  });

  vscode.postMessage({ type: "ready" });

  return {
    getJson(path) {
      return new Promise((resolve) => {
        const id = crypto.randomUUID();
        pendingGet.set(id, resolve);
        vscode.postMessage({ type: "get", id, path });
      });
    },

    postJson(path, body) {
      return new Promise((resolve) => {
        const id = crypto.randomUUID();
        pendingPost.set(id, resolve);
        vscode.postMessage({ type: "post", id, path, body });
      });
    },

    subscribe(options: SubscribeOptions) {
      pushHandlers.add(options);
      vscode.postMessage({ type: "subscribe" });
      options.onConnect();

      return () => {
        pushHandlers.delete(options);
        vscode.postMessage({ type: "unsubscribe" });
      };
    },
  };
}
