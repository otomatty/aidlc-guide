import path from "node:path";
import { type ExtensionContext, type Terminal, window } from "vscode";
import { type NativeInstall, nativeCommandEnv } from "./native-setup.ts";

/** Apply the verified launcher directory to terminals created after setup. */
export function configureCliEnvironment(context: ExtensionContext, native: NativeInstall): void {
  if (
    !path.isAbsolute(native.binDir) ||
    native.binDir.includes(path.delimiter) ||
    /[\r\n\0]/.test(native.binDir)
  )
    throw new Error("CLIの配置先をPATHに設定できません。導入先の絶対パスを確認してください。");
  // VS Code replaces this extension's previous mutation for the same variable.
  context.environmentVariableCollection.prepend("PATH", `${native.binDir}${path.delimiter}`);
}

/** Run the public command in a fresh terminal with the configured launcher on PATH. */
export function openCliTerminal(
  context: ExtensionContext,
  native: NativeInstall,
  root: string,
): Terminal {
  configureCliEnvironment(context, native);
  const terminal = window.createTerminal({
    name: "AI-DLC CLI",
    cwd: root,
    env: nativeCommandEnv(native),
  });
  terminal.show();
  terminal.sendText("aidlc --version");
  return terminal;
}
