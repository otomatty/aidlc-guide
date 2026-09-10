import path from "node:path";
import {
  createGuideService,
  type GuideService,
  routePost,
  routeRead,
  UNKNOWN_ROUTE,
} from "@aidlc-guide/api-core";
import type { WsMessage } from "@aidlc-guide/shared-types";
import {
  type ExtensionContext,
  type FileSystemWatcher,
  RelativePattern,
  type Webview,
  workspace,
} from "vscode";

export const SELECTED_INTENT_KEY = "aidlcGuide.selectedIntent";

export interface SelectedIntentPersist {
  get(): string | undefined;
  set(slug: string | null): void;
}

export function persistSelectedIntent(context: ExtensionContext): SelectedIntentPersist {
  return {
    get: () => context.workspaceState.get<string>(SELECTED_INTENT_KEY),
    set: (slug) => {
      void context.workspaceState.update(SELECTED_INTENT_KEY, slug).then(undefined, () => {
        // Persist is best-effort; the in-memory pin stays.
      });
    },
  };
}

/** One workspace session — api-core in-process, push to every subscribed webview. */
export class GuideSession {
  readonly service: GuideService;
  private unwatch: () => void;
  private readonly creationWatcher: FileSystemWatcher;
  private disposed = false;
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

  constructor(
    workspaceRoot: string,
    officialDocsRoot: string = workspaceRoot,
    persist?: SelectedIntentPersist,
  ) {
    this.service = createGuideService({
      workspaceRoot,
      officialDocsRoot,
      initialSelected: persist?.get() ?? null,
      onSelect: persist?.set,
    });
    this.service.hub.add(this.pushClient);
    this.creationWatcher = workspace.createFileSystemWatcher(
      new RelativePattern(workspaceRoot, "aidlc/spaces/*/intents/*/aidlc-state.md"),
      false,
      true,
      true,
    );
    this.creationWatcher.onDidCreate((uri) => {
      void this.onRecordCreated(uri.fsPath).catch(() => {
        if (!this.disposed)
          this.service.hub.broadcast({
            type: "live-status",
            degraded: true,
            reason: "watcher-lost",
          });
      });
    });
    this.service.startMatrixBackground();
    this.unwatch = this.service.startWatch();
  }

  /** A session created before setup has no record watcher until the first state file appears. */
  private async onRecordCreated(file: string): Promise<void> {
    const record = await this.service.readContext.recordDir();
    if (this.disposed || !("ok" in record) || path.dirname(file) !== record.value) return;
    this.unwatch();
    this.unwatch = this.service.startWatch();
    await this.service.hub.handleWatchEvent(
      { type: "change", scope: "state", path: file },
      () => !this.disposed,
    );
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
    const result = await routePost(this.service, path, body);
    if (result === null) return { ok: false, ...UNKNOWN_ROUTE };
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      body: result.body,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.creationWatcher.dispose();
    this.unwatch();
    this.service.hub.remove(this.pushClient);
    this.webviews.clear();
  }
}

const sessions = new Map<string, GuideSession>();
const owners = new Map<GuideSession, number>();

/** Keep a shared watcher alive only while a status bar or dashboard owns it. */
export function acquireSession(
  workspaceRoot: string,
  officialDocsRoot: string = workspaceRoot,
  persist?: SelectedIntentPersist,
): { session: GuideSession; dispose(): void } {
  const session = getOrCreateSession(workspaceRoot, officialDocsRoot, persist);
  owners.set(session, (owners.get(session) ?? 0) + 1);
  let released = false;
  return {
    session,
    dispose() {
      if (released) return;
      released = true;
      if (sessions.get(workspaceRoot) !== session) return;
      const remaining = (owners.get(session) ?? 1) - 1;
      if (remaining === 0) disposeSession(workspaceRoot);
      else owners.set(session, remaining);
    },
  };
}

export function getOrCreateSession(
  workspaceRoot: string,
  officialDocsRoot: string = workspaceRoot,
  persist?: SelectedIntentPersist,
): GuideSession {
  let session = sessions.get(workspaceRoot);
  if (session === undefined) {
    session = new GuideSession(workspaceRoot, officialDocsRoot, persist);
    sessions.set(workspaceRoot, session);
  }
  return session;
}

function disposeSession(workspaceRoot: string): void {
  const session = sessions.get(workspaceRoot);
  if (session === undefined) return;
  session.dispose();
  owners.delete(session);
  sessions.delete(workspaceRoot);
}

export function disposeAllSessions(): void {
  for (const root of [...sessions.keys()]) disposeSession(root);
}
