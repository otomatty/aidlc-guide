import { commands, Uri } from "vscode";

/** Install a local VSIX the same way "Install from VSIX" does. */
export async function sideloadVsix(filePath: string): Promise<void> {
  const known = await commands.getCommands(true);
  if (!known.includes("workbench.extensions.installExtension")) {
    throw new Error("このホストは VSIX のプログラムインストールに対応していません。");
  }
  try {
    await commands.executeCommand("workbench.extensions.installExtension", Uri.file(filePath));
  } catch (cause) {
    const message = cause instanceof Error && cause.message !== "" ? cause.message : String(cause);
    throw new Error(`VSIX のインストールに失敗しました: ${message}`);
  }
}
