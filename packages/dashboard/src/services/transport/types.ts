import type { WsMessage } from "@aidlc-guide/shared-types";

export type GetJsonResult = { reached: true; body: unknown } | { reached: false };

export interface PostJsonResult {
  ok: boolean;
  status: number;
  body: unknown;
}

export interface SubscribeOptions {
  wsUrl?: string;
  /** Injected in tests; defaults to the platform WebSocket constructor. */
  createWebSocket?: (url: string) => WebSocket;
  onConnect: () => void;
  onDisconnect: () => void;
  onMessage: (message: WsMessage) => void;
}

/**
 * Pluggable wire layer for the dashboard UI.
 * Browser: fetch + WebSocket. VS Code webview: postMessage to extension host.
 */
export interface Transport {
  getJson(path: string): Promise<GetJsonResult>;
  postJson(path: string, body: unknown): Promise<PostJsonResult>;
  /** Push subscription. Returns unsubscribe. */
  subscribe(options: SubscribeOptions): () => void;
}

let active: Transport | null = null;

export function setTransport(transport: Transport): void {
  active = transport;
}

export function getTransport(): Transport {
  if (active === null) {
    throw new Error("Transport not initialized — call initTransport() in main.tsx");
  }
  return active;
}

/** Detect VS Code webview vs browser and install the default transport. */
export async function initTransport(): Promise<Transport> {
  if (active !== null) return active;

  const vscodeApi =
    typeof window !== "undefined" &&
    "acquireVsCodeApi" in window &&
    typeof (window as Window & { acquireVsCodeApi?: () => unknown }).acquireVsCodeApi ===
      "function";

  if (vscodeApi) {
    const { createVscodeTransport } = await import("./vscode.ts");
    active = createVscodeTransport();
  } else {
    const { createBrowserTransport } = await import("./browser.ts");
    active = createBrowserTransport();
  }
  return active;
}

export function wsUrlFromLocation(location: { protocol: string; host: string }): string {
  return `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`;
}
