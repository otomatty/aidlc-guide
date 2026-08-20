import path from "node:path";
import { HOST_EXPOSURE_WARNING } from "@aidlc-guide/api-core";
import { type ExtensionContext, window, workspace } from "vscode";
import { btwCliPath } from "./mcp-register.ts";

/** The open workspace root, or `undefined` after telling the user to open one. */
function requireRoot(): string | undefined {
  const root = workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (root === undefined) void window.showErrorMessage("ワークスペースを開いてください。");
  return root;
}

export function runInTerminal(name: string, cwd: string, command: string): void {
  const terminal = window.createTerminal({ name, cwd });
  terminal.show();
  terminal.sendText(command);
}

export async function launchBtw(context: ExtensionContext, fork: boolean): Promise<void> {
  const root = requireRoot();
  if (root === undefined) return;

  const cli = btwCliPath(context.extensionPath);
  const args = ["run", cli.replace(/\\/g, "/")];
  if (fork) args.push("--fork");
  runInTerminal("AIDLC btw", root, `bun ${args.join(" ")}`);
}

export async function askOneShot(context: ExtensionContext): Promise<void> {
  const root = requireRoot();
  if (root === undefined) return;

  const question = await window.showInputBox({
    prompt: "サイド質問（読取専用 plan モード）",
    placeHolder: "例: 今のステージで何を確認すべき？",
  });
  if (question === undefined || question.trim() === "") return;

  const cli = btwCliPath(context.extensionPath);
  const escaped = question.replace(/"/g, '\\"');
  runInTerminal("AIDLC btw", root, `bun run "${cli.replace(/\\/g, "/")}" -p "${escaped}"`);
}

export async function shareOnLan(context: ExtensionContext): Promise<void> {
  const root = requireRoot();
  if (root === undefined) return;

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
  runInTerminal("AIDLC Dashboard (LAN)", root, `bun run "${serverCli}" --host`);
  void window.showInformationMessage(
    "Dashboard を LAN 公開しました。ターミナルの URL を参加者に共有してください。",
  );
}
