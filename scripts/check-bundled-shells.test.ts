import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkBundledShells } from "./check-bundled-shells.ts";
import { hash } from "./doctor-evidence.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "bundled-shells-"));
  roots.push(root);
  const upstream = path.join(root, "official");
  const workspace = path.join(root, "guide");
  const write = (file: string, text: string) => {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  const adapter = ".cursor/hooks/aidlc-cursor-adapter.ts";
  write(
    path.join(upstream, "dist/claude/.claude/tools/aidlc-version.ts"),
    'export const AIDLC_VERSION = "2.9.0";\n',
  );
  write(
    path.join(workspace, ".claude/tools/aidlc-version.ts"),
    'export const AIDLC_VERSION = "2.9.0";\n',
  );
  write(path.join(upstream, "dist/cursor", adapter), "official\n");
  write(path.join(workspace, adapter), "reviewed patch\n");
  write(
    path.join(workspace, "scripts/workflows-shell-overrides.json"),
    JSON.stringify({
      [adapter]: {
        upstreamSha256: hash("official\n"),
        workspaceSha256: hash("reviewed patch\n"),
        reason: "test patch",
      },
    }),
  );
  return { workspace, upstream, write, adapter };
}
describe("official shell parity", () => {
  it("accepts only the reviewed source and local patch pair", () => {
    const f = fixture();
    expect(checkBundledShells(f.workspace, f.upstream)).toEqual([]);
    f.write(path.join(f.upstream, "dist/cursor", f.adapter), "changed upstream\n");
    expect(checkBundledShells(f.workspace, f.upstream)).toContain(
      `bundled shell differs from official release: ${f.adapter}`,
    );
  });
  it("detects a local edit and a deleted required engine file", () => {
    const f = fixture();
    f.write(path.join(f.workspace, f.adapter), "unreviewed patch\n");
    const file = ".claude/tools/aidlc-version.ts";
    rmSync(path.join(f.workspace, file));
    const errors = checkBundledShells(f.workspace, f.upstream);
    expect(errors).toContain(`bundled shell differs from official release: ${f.adapter}`);
    expect(errors).toContain(`bundled shell differs from official release: ${file}`);
  });
});
