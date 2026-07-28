import {
  createGuideService,
  type GuideService,
  routeAnswer,
  routeRead,
  UNKNOWN_ROUTE,
} from "@aidlc-guide/api-core";
import type { WsMessage } from "@aidlc-guide/shared-types";
import type { Webview } from "vscode";

/** One workspace session — api-core in-process, push to every subscribed webview. */
export class GuideSession {
  readonly service: GuideService;
  private readonly unwatch: () => void;
  private readonly webviews = new Set<Webview>();
  private readonly pushClient = {
    send: (data: string) => {
      let message: WsMessage;
      try {
        message = JSON.parse(data) as WsMessage;
      } catch {
        return;
      }
      for (const webview of this.webviews) {
        void webview.postMessage({ type: "push", message });
      }
    },
  };

  constructor(workspaceRoot: string) {
    this.service = createGuideService({ workspaceRoot });
    this.service.hub.add(this.pushClient);
    this.service.startMatrixBackground();
    this.unwatch = this.service.startWatch();
  }

  subscribe(webview: Webview): () => void {
    this.webviews.add(webview);
    void webview.postMessage({ type: "connected" });
    return () => {
      this.webviews.delete(webview);
    };
  }

  async handleGet(path: string): Promise<{ reached: true; body: unknown } | { reached: false }> {
    try {
      const url = new URL(path, "http://aidlc-guide.local");
      const result = await routeRead(this.service.readContext, url);
      if (result === null) return { reached: false };
      return { reached: true, body: result.body };
    } catch {
      return { reached: false };
    }
  }

  async handlePost(
    path: string,
    body: unknown,
  ): Promise<{ ok: boolean; status: number; body: unknown }> {
    if (path !== "/api/answer") {
      return { ok: false, ...UNKNOWN_ROUTE };
    }
    const result = await routeAnswer(this.service.answerContext, body);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      body: result.body,
    };
  }

  dispose(): void {
    this.unwatch();
    this.service.hub.remove(this.pushClient);
    this.webviews.clear();
  }
}

const sessions = new Map<string, GuideSession>();

export function getOrCreateSession(workspaceRoot: string): GuideSession {
  let session = sessions.get(workspaceRoot);
  if (session === undefined) {
    session = new GuideSession(workspaceRoot);
    sessions.set(workspaceRoot, session);
  }
  return session;
}

function disposeSession(workspaceRoot: string): void {
  const session = sessions.get(workspaceRoot);
  if (session === undefined) return;
  session.dispose();
  sessions.delete(workspaceRoot);
}

export function disposeAllSessions(): void {
  for (const root of [...sessions.keys()]) disposeSession(root);
}
