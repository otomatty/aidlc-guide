import type { WsMessage } from "@aidlc-guide/shared-types";
import { backoffFor } from "../live-backoff.ts";
import type { SubscribeOptions, Transport } from "./types.ts";
import { wsUrlFromLocation } from "./types.ts";

export function createBrowserTransport(): Transport {
  return {
    async getJson(path) {
      try {
        const response = await fetch(path, { headers: { accept: "application/json" } });
        return { reached: true, body: (await response.json()) as unknown };
      } catch {
        return { reached: false };
      }
    },

    async postJson(path, body) {
      try {
        const response = await fetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        let parsed: unknown;
        try {
          parsed = (await response.json()) as unknown;
        } catch {
          parsed = {};
        }
        return { ok: response.ok, status: response.status, body: parsed };
      } catch {
        return { ok: false, status: 0, body: {} };
      }
    },

    subscribe(options: SubscribeOptions) {
      const target = options.wsUrl ?? wsUrlFromLocation(window.location);
      const open = options.createWebSocket ?? ((address: string) => new WebSocket(address));

      let attempt = 0;
      let socket: WebSocket | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let stopped = false;

      const connect = (): void => {
        if (stopped) return;
        let next: WebSocket;
        try {
          next = open(target);
        } catch {
          schedule();
          return;
        }
        socket = next;

        next.onopen = () => {
          attempt = 0;
          options.onConnect();
        };

        next.onmessage = (event: MessageEvent) => {
          try {
            const message = JSON.parse(String(event.data)) as WsMessage;
            options.onMessage(message);
          } catch {
            // Drop unparseable frames.
          }
        };

        next.onerror = () => {
          next.close();
        };

        next.onclose = () => {
          options.onDisconnect();
          schedule();
        };
      };

      const schedule = (): void => {
        if (stopped) return;
        const delay = backoffFor(attempt);
        attempt += 1;
        timer = setTimeout(connect, delay);
      };

      connect();

      return () => {
        stopped = true;
        if (timer !== null) clearTimeout(timer);
        if (socket !== null) {
          socket.onclose = null;
          socket.close();
        }
      };
    },
  };
}
