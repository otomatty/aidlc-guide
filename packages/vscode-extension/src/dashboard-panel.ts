import path from "node:path";
import { commands, type ExtensionContext, Uri, ViewColumn, type Webview, window } from "vscode";
import { loadDashboardHtml } from "./dashboard-html.ts";
import { getOrCreateSession } from "./guide-session.ts";

const PANEL_VIEW_TYPE = "aidlcGuide.dashboard";

function mediaRoot(context: ExtensionContext): string {
  return path.join(context.extensionPath, "media", "dashboard");
}

function wireWebview(webview: Webview, workspaceRoot: string): () => void {
  const session = getOrCreateSession(workspaceRoot);
  const unsubscribe = session.subscribe(webview);

  const sub = webview.onDidReceiveMessage(async (message: unknown) => {
    if (typeof message !== "object" || message === null) return;
    const msg = message as Record<string, unknown>;

    if (msg.type === "get" && typeof msg.id === "string" && typeof msg.path === "string") {
      const result = await session.handleGet(msg.path);
      void webview.postMessage({
        type: "get-response",
        id: msg.id,
        reached: result.reached,
        body: result.reached ? result.body : undefined,
      });
      return;
    }

    if (msg.type === "post" && typeof msg.id === "string" && typeof msg.path === "string") {
      const result = await session.handlePost(msg.path, msg.body);
      void webview.postMessage({
        type: "post-response",
        id: msg.id,
        ok: result.ok,
        status: result.status,
        body: result.body,
      });
      return;
    }

    if (msg.type === "open-doc" && typeof msg.path === "string") {
      const rel = msg.path.replace(/^\.\//, "");
      const cfg = await session.service.readContext.bridge.getConfig();
      const root =
        "ok" in cfg && cfg.value.docsRepoPath !== null ? cfg.value.docsRepoPath : workspaceRoot;
      const file = Uri.file(path.resolve(root, rel));
      const fragment =
        typeof msg.anchor === "string" && msg.anchor !== "" && msg.anchor !== "#"
          ? msg.anchor.startsWith("#")
            ? msg.anchor.slice(1)
            : msg.anchor
          : undefined;
      try {
        await commands.executeCommand(
          "vscode.open",
          fragment === undefined ? file : file.with({ fragment }),
        );
      } catch (cause) {
        void window.showErrorMessage(
          `docs を開けませんでした: ${file.fsPath}${cause instanceof Error ? ` (${cause.message})` : ""}`,
        );
      }
    }
  });

  return () => {
    unsubscribe();
    sub.dispose();
  };
}

export function openDashboardPanel(context: ExtensionContext, workspaceRoot: string): void {
  const panel = window.createWebviewPanel(PANEL_VIEW_TYPE, "AIDLC Guide", ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [Uri.file(mediaRoot(context))],
  });

  void loadDashboardHtml(panel.webview, context).then((html) => {
    panel.webview.html = html;
  });

  const teardown = wireWebview(panel.webview, workspaceRoot);
  panel.onDidDispose(teardown);
}
