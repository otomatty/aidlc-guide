#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "./doctor-evidence.ts";
import { HARNESSES, planShellSync, walkShellFiles } from "./sync-workflows-shell.ts";

export type ShellOverride = { upstreamSha256: string; workspaceSha256: string; reason: string };
export const shellHash = (file: string) => hash(readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
export function readShellOverrides(root: string): Record<string, ShellOverride> {
  return JSON.parse(
    readFileSync(path.join(root, "scripts/workflows-shell-overrides.json"), "utf8"),
  );
}
export function checkBundledShells(root: string, upstream: string): string[] {
  const overrides = readShellOverrides(root);
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const harness of HARNESSES) {
    const from = path.join(upstream, harness.upstreamRel);
    const plan = planShellSync(
      walkShellFiles(from),
      walkShellFiles(path.join(root, harness.localRel)),
      harness.localOnly,
      harness.ignored,
    );
    for (const file of [...plan.writes, ...plan.deletes]) {
      const relative = `${harness.localRel}/${file}`;
      const override = overrides[relative];
      if (override && !plan.deletes.includes(file)) {
        seen.add(relative);
        try {
          if (
            shellHash(path.join(from, file)) === override.upstreamSha256 &&
            shellHash(path.join(root, relative)) === override.workspaceSha256
          )
            continue;
        } catch {
          /* Missing files still fail. */
        }
      }
      errors.push(`bundled shell differs from official release: ${relative}`);
    }
  }
  for (const file of Object.keys(overrides))
    if (!seen.has(file)) errors.push(`shell override is missing or no longer required: ${file}`);
  return errors;
}
if (import.meta.main) {
  const upstream = process.argv[2];
  if (!upstream) throw new Error("usage: check-bundled-shells <official generated checkout>");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const errors = checkBundledShells(root, upstream);
  console.log(
    errors.length
      ? errors.join("\n")
      : "bundled shells match the official source, including the reviewed Cursor override",
  );
  process.exitCode = errors.length ? 1 : 0;
}
