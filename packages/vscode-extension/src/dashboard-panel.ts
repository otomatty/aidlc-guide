import path from "node:path";
import { commands, type ExtensionContext, Uri, ViewColumn, type Webview, window } from "vscode";
import { loadDashboardHtml } from "./dashboard-html.ts";
import { docTarget } from "./file-ref-target.ts";
import { getOrCreateSession } from "./guide-session.ts";
import { resolveOfficialDocsRoot } from "./official-docs-root.ts";
import { openFileRef } from "./open-file.ts";
import {
  getLastOfficialDocsLocale,
  handleOpenOfficialDoc,
  injectDocsShellDeepLink,
  OFFICIAL_DOCS_LOCALE_KEY,
} from "./open-official-doc.ts";

const PANEL_VIEW_TYPE = "aidlcGuide.dashboard";

function mediaRoot(context: ExtensionContext): string {
  return path.join(context.extensionPath, "media", "dashboard");
}

function wireWebview(
  webview: Webview,
  workspaceRoot: string,
  officialDocsRoot: string,
  context: ExtensionContext,
): () => void {
  const session = getOrCreateSession(workspaceRoot, officialDocsRoot);
  const unsubscribe = session.subscribe(webview);

  const sub = webview.onDidReceiveMessage(async (message: unknown) => {
    if (typeof message !== "object" || message === null) return;
    const msg = message as Record<string, unknown>;

    // Webview transport posts `ready` on init — seed persisted locale so
    // OpenOfficialDocLink does not default to "en" after panel reload.
    if (msg.type === "ready") {
      void webview.postMessage({
        type: "official-docs-locale",
        locale: getLastOfficialDocsLocale(context),
      });
      return;
    }

    // LocaleControl → host persist (reload / ready bootstrap must keep choice).
    if (msg.type === "official-docs-locale" && (msg.locale === "en" || msg.locale === "ja")) {
      void context.globalState.update(OFFICIAL_DOCS_LOCALE_KEY, msg.locale);
      return;
    }

    if (msg.type === "open-official-doc") {
      const outcome = handleOpenOfficialDoc(message, context);
      if (outcome.ok) {
        injectDocsShellDeepLink(webview, outcome.inject);
      }
      // Invalid → ignore (no persist already; no Shell; no vscode.open).
      return;
    }

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

    if (msg.type === "open-file" && typeof msg.path === "string") {
      try {
        const beside = msg.beside === true;
        const base = msg.base === "record" ? "record" : "workspace";
        const preview = msg.preview === false ? false : undefined;
        let recordDir: string | undefined;
        if (base === "record") {
          const record = await session.service.readContext.recordDir();
          if (!("ok" in record)) {
            void window.showWarningMessage(`レコードを解決できません: ${msg.path}`);
            return;
          }
          recordDir = record.value;
        }
        await openFileRef(workspaceRoot, msg.path, typeof msg.line === "number" ? msg.line : null, {
          beside,
          base,
          recordDir,
          preview,
        });
      } catch (cause) {
        void window.showErrorMessage(
          `ファイルを開けませんでした: ${msg.path}${cause instanceof Error ? ` (${cause.message})` : ""}`,
        );
      }
      return;
    }

    if (msg.type === "open-doc" && typeof msg.path === "string") {
      const cfg = await session.service.readContext.bridge.getConfig();
      const root =
        "ok" in cfg && cfg.value.docsRepoPath !== null ? cfg.value.docsRepoPath : workspaceRoot;
      // Trust boundary: the webview's path goes through the same
      // normalise-and-contain gate as `open-file`, never straight to resolve.
      const target = docTarget(root, msg.path);
      if (target === null) {
        void window.showErrorMessage(`docs を開けませんでした: ${msg.path}`);
        return;
      }
      const file = Uri.file(target);
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

  const officialDocsRoot = resolveOfficialDocsRoot(context.extensionPath, workspaceRoot);
  const teardown = wireWebview(panel.webview, workspaceRoot, officialDocsRoot, context);
  panel.onDidDispose(teardown);
}
