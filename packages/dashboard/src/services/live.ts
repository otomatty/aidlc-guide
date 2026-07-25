import type { WsMessage } from "@aidlc-guide/shared-types";
import { type Dispatch, useEffect, useRef } from "react";
import type { Action } from "../store/reducer.ts";
import { refetchAll } from "./api.ts";

/**
 * WS subscription + reconnect (R-UI-4). The schedule is exported so the test
 * asserts the actual delays rather than a copy of them.
 */
export const BACKOFF_MS = [1000, 2000, 4000, 8000, 10000] as const;

export function backoffFor(attempt: number): number {
  const capped = Math.min(attempt, BACKOFF_MS.length - 1);
  // `noUncheckedIndexedAccess`: the clamp above makes this always defined.
  return BACKOFF_MS[capped] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 10_000;
}

export function wsUrl(location: { protocol: string; host: string }): string {
  return `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`;
}

export interface LiveOptions {
  url?: string;
  /** Injected in tests; defaults to the platform constructor. */
  create?: (url: string) => WebSocket;
}

/**
 * Opens the socket, re-reads REST state on every (re)connect, and reconnects
 * with exponential backoff until unmounted. There is no send path — the server
 * never reads from the socket (S-DS-6) and this unit never writes (S-UI-1).
 */
export function useLiveConnection(dispatch: Dispatch<Action>, options: LiveOptions = {}): void {
  const { url, create } = options;
  // Latest-value refs keep the effect's dependency list empty, so a re-render
  // never tears down a healthy socket.
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    const target = url ?? wsUrl(window.location);
    const open = create ?? ((address: string) => new WebSocket(address));

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
        // Constructing can throw while the server is down; treat it as a close.
        schedule();
        return;
      }
      socket = next;

      next.onopen = () => {
        attempt = 0;
        dispatchRef.current({ type: "live", connected: true });
        // The socket carries deltas only: without this re-read, anything that
        // changed while we were disconnected would be lost forever.
        void refetchAll(dispatchRef.current);
      };

      next.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(String(event.data)) as WsMessage;
          // Stamped at the socket, not in the reducer: 「最終更新」 must be the
          // moment a change actually arrived (mob-mode R-MM-3).
          dispatchRef.current({ type: "ws", message, receivedAt: new Date().toISOString() });
        } catch {
          // A frame we cannot parse is dropped, not fatal — the next change
          // event re-syncs us. Never crash the app on server output.
        }
      };

      next.onerror = () => {
        next.close();
      };

      next.onclose = () => {
        dispatchRef.current({ type: "live", connected: false });
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
  }, [url, create]);
}
