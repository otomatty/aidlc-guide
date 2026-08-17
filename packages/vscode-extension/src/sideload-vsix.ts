import { commands, Uri } from "vscode";

/** Install a local VSIX the same way "Install from VSIX" does. */
export async function sideloadVsix(filePath: string): Promise<void> {
  await commands.executeCommand("workbench.extensions.installExtension", Uri.file(filePath));
}
