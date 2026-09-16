import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  commitRepairFiles,
  repairPath,
  seedRepairFiles,
  snapshotRepairFiles,
} from "../src/workflows-repair-files.ts";

const roots: string[] = [];
async function temporary() {
  const root = await mkdtemp(path.join(tmpdir(), "repair-files-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
it("rejects traversal, absolute paths and symlink parents", async () => {
  const root = await temporary(),
    outside = await temporary();
  for (const rel of ["../outside", "/abs", "C:/abs", "a\\b", "a/./b", "a//b"])
    expect(() => repairPath(root, rel)).toThrow();
  await symlink(
    outside,
    path.join(root, ".claude"),
    process.platform === "win32" ? "junction" : "dir",
  );
  expect(() => snapshotRepairFiles(root)).toThrow("リンク");
});
it("preserves project policy and application files even if staging changed them", async () => {
  const root = await temporary(),
    stage = await temporary(),
    backupParent = await temporary();
  mkdirSync(path.join(root, "aidlc/spaces/default/memory"), { recursive: true });
  writeFileSync(path.join(root, "aidlc/spaces/default/memory/project.md"), "user policy");
  writeFileSync(path.join(root, ".gitignore"), "old");
  const before = snapshotRepairFiles(root);
  seedRepairFiles(stage, before);
  writeFileSync(path.join(stage, ".gitignore"), "new");
  writeFileSync(path.join(stage, "aidlc/spaces/default/memory/project.md"), "generated policy");
  writeFileSync(path.join(stage, "app.ts"), "unrelated");
  const result = await commitRepairFiles({
    root,
    stage,
    before,
    backupParent,
    signal: new AbortController().signal,
    isCurrent: () => true,
  });
  expect(result.changed).toEqual([".gitignore"]);
  expect(readFileSync(path.join(root, "aidlc/spaces/default/memory/project.md"), "utf8")).toBe(
    "user policy",
  );
});
it("rolls back an interrupted multi-file commit and keeps backups", async () => {
  const root = await temporary(),
    stage = await temporary(),
    backupParent = await temporary();
  writeFileSync(path.join(root, ".gitignore"), "old ignore");
  writeFileSync(path.join(root, "AGENTS.md"), "old agents");
  const before = snapshotRepairFiles(root);
  seedRepairFiles(stage, before);
  writeFileSync(path.join(stage, ".gitignore"), "new ignore");
  writeFileSync(path.join(stage, "AGENTS.md"), "new agents");
  const controller = new AbortController();
  const isCurrent = () => {
    if (readFileSync(path.join(root, ".gitignore"), "utf8") === "new ignore") {
      controller.abort();
      return false;
    }
    return true;
  };
  await expect(
    commitRepairFiles({ root, stage, before, backupParent, signal: controller.signal, isCurrent }),
  ).rejects.toThrow();
  expect(readFileSync(path.join(root, ".gitignore"), "utf8")).toBe("old ignore");
  expect(readFileSync(path.join(root, "AGENTS.md"), "utf8")).toBe("old agents");
});
