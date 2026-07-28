import path from "node:path";
import { HOST_EXPOSURE_WARNING } from "@aidlc-guide/api-core";
import { type ExtensionContext, window, workspace } from "vscode";
import { btwCliPath } from "./mcp-register.ts";

function workspaceRoot(): string | undefined {
  return workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function launchBtw(context: ExtensionContext, fork: boolean): Promise<void> {
  const root = workspaceRoot();
  if (root === undefined) {
    void window.showErrorMessage("ワークスペースを開いてください。");
    return;
  }

  const cli = btwCliPath(context.extensionPath);
  const args = ["run", cli.replace(/\\/g, "/")];
  if (fork) args.push("--fork");

  const terminal = window.createTerminal({ name: "AIDLC btw", cwd: root });
  terminal.show();
  terminal.sendText(`bun ${args.join(" ")}`);
}

export async function askOneShot(context: ExtensionContext): Promise<void> {
  const root = workspaceRoot();
  if (root === undefined) {
    void window.showErrorMessage("ワークスペースを開いてください。");
    return;
  }

  const question = await window.showInputBox({
    prompt: "サイド質問（読取専用 plan モード）",
    placeHolder: "例: 今のステージで何を確認すべき？",
  });
  if (question === undefined || question.trim() === "") return;

  const cli = btwCliPath(context.extensionPath);
  const escaped = question.replace(/"/g, '\\"');
  const terminal = window.createTerminal({ name: "AIDLC btw", cwd: root });
  terminal.show();
  terminal.sendText(`bun run "${cli.replace(/\\/g, "/")}" -p "${escaped}"`);
}

export async function shareOnLan(context: ExtensionContext): Promise<void> {
  const root = workspaceRoot();
  if (root === undefined) {
    void window.showErrorMessage("ワークスペースを開いてください。");
    return;
  }

  // S-MM-2: one wording, imported — never retyped per surface.
  const confirm = await window.showWarningMessage(
    `${HOST_EXPOSURE_WARNING}\n\n続行しますか？`,
    { modal: true },
    "Share on LAN",
  );
  if (confirm !== "Share on LAN") return;

  const serverCli = path
    .join(context.extensionPath, "..", "dashboard-server", "src", "cli.ts")
    .replace(/\\/g, "/");

  const terminal = window.createTerminal({ name: "AIDLC Dashboard (LAN)", cwd: root });
  terminal.show();
  terminal.sendText(`bun run "${serverCli}" --host`);
  void window.showInformationMessage(
    "Dashboard を LAN 公開しました。ターミナルの URL を参加者に共有してください。",
  );
}
