import { window } from "vscode";

export function showPlainNotice(message: string): void {
  const text = message === "Up to date." ? "\u6700\u65b0\u7248\u3067\u3059\u3002" : message;
  void window.showInformationMessage(text);
}
