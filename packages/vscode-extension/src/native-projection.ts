import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const PROJECTIONS = {
  ".claude": ["claude"],
  ".cursor": ["cursor"],
  ".codex": ["codex"],
  ".kiro": ["kiro", "kiro-ide"],
  ".aidlc": ["copilot", "opencode"],
} as const;

export function readNativeProjections(root: string): {
  harness: string;
  version: string | null;
  sourcePath: string;
  raw: string;
}[] {
  const found = [];
  for (const [dir, allowed] of Object.entries(PROJECTIONS)) {
    const sourcePath = path.join(root, dir, "tools", "data", "aidlc-stamp.json");
    if (!existsSync(sourcePath)) continue;
    try {
      const raw = readFileSync(sourcePath, "utf8");
      const stamp = JSON.parse(raw);
      if (
        stamp?.schemaVersion !== 1 ||
        !(allowed as readonly string[]).includes(stamp.distribution)
      )
        continue;
      const version =
        typeof stamp.frameworkVersion === "string" &&
        /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(stamp.frameworkVersion)
          ? stamp.frameworkVersion
          : null;
      found.push({ harness: stamp.distribution as string, version, sourcePath, raw });
    } catch {
      // A partial or invalid stamp is not proof of a configured installation.
    }
  }
  return found;
}
