import { execFile } from "node:child_process";

/** Git handles parent repositories, linked worktrees and submodules consistently. */
export function isGitRepository(root: string): Promise<boolean> {
  const env = { ...process.env };
  // The question is about this folder, not a repository selected by the parent shell.
  for (const key of Object.keys(env)) if (key.toUpperCase().startsWith("GIT_")) delete env[key];
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-C", root, "rev-parse", "--is-inside-work-tree"],
      {
        env,
        windowsHide: true,
        timeout: 5000,
        maxBuffer: 4096,
      },
      (error, stdout) => resolve(!error && stdout.trim() === "true"),
    );
  });
}

export const CODEX_GIT_REQUIRED =
  "Codex のプロジェクトフックには Git リポジトリが必要です。このフォルダで git init を実行するか、既存のリポジトリを開いてから、状態を再確認してください。";
