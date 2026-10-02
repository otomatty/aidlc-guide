import { window } from "vscode";

export function runInTerminal(name: string, cwd: string, command: string): void {
  const terminal = window.createTerminal({ name, cwd });
  terminal.show();
  terminal.sendText(command);
}
