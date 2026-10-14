import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import type { SpaceCatalog } from "@aidlc-guide/shared-types";

export interface SpaceEngine {
  harnesses(): Promise<SpaceCatalog["harnesses"]>;
  switch(space: string, harness: string): Promise<void>;
}
const HARNESSES = [
  { id: ".cursor", label: "Cursor" },
  { id: ".claude", label: "Claude Code" },
  { id: ".codex", label: "Codex" },
  { id: ".kiro", label: "Kiro" },
  { id: ".aidlc", label: "opencode" },
  { id: ".github", label: "GitHub Copilot" },
];

/** The official utility owns cursors, session bindings, and native rule includes. */
export function createSpaceEngine(root: string): SpaceEngine {
  const scriptFor = async (harness: string): Promise<string | null> => {
    if (!HARNESSES.some((item) => item.id === harness)) return null;
    let current = await realpath(root);
    try {
      for (const part of [harness, "tools", "aidlc-utility.ts"]) {
        current = path.join(current, part);
        if ((await lstat(current)).isSymbolicLink()) return null;
      }
      return (await lstat(current)).isFile() ? current : null;
    } catch {
      return null;
    }
  };
  return {
    async harnesses() {
      const found = await Promise.all(
        HARNESSES.map(async (item) => ((await scriptFor(item.id)) ? item : null)),
      );
      return found.filter((item) => item !== null);
    },
    async switch(space, harness) {
      const script = await scriptFor(harness);
      if (!script) throw new Error("選択したツールのAI-DLC本体を読み込めません。");
      const workspace = await realpath(root);
      // A GUI action belongs to Guide, never to an inherited terminal/chat session.
      const session = `aidlc-guide-${createHash("sha256").update(workspace).digest("hex").slice(0, 24)}`;
      await new Promise<void>((resolve, reject) => {
        execFile(
          "bun",
          [script, "space", "switch", space, "--project-dir", workspace],
          {
            cwd: workspace,
            windowsHide: true,
            timeout: 30_000,
            maxBuffer: 1024 * 1024,
            env: {
              ...process.env,
              AIDLC_PROJECT_DIR: workspace,
              AIDLC_HARNESS_DIR: harness,
              AIDLC_SESSION_OVERRIDE: session,
              AIDLC_SESSION_OVERRIDE_SOURCE: "payload",
            },
          },
          (error) =>
            error
              ? reject(
                  new Error(
                    "スペースを切り替えられませんでした。BunとAI-DLC本体を確認して再試行してください。",
                  ),
                )
              : resolve(),
        );
      });
    },
  };
}
