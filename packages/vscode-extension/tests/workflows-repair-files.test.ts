import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
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

it.each(["permissions", "file type"])(
  "rejects concurrent %s changes immediately before apply",
  async (change) => {
    const root = await temporary(),
      stage = await temporary(),
      backupParent = await temporary();
    const file = path.join(root, ".gitignore");
    writeFileSync(file, "old");
    chmodSync(file, 0o666);
    const before = snapshotRepairFiles(root);
    seedRepairFiles(stage, before);
    writeFileSync(path.join(stage, ".gitignore"), "new");
    let changed = false;
    const isCurrent = () => {
      if (
        !changed &&
        readdirSync(backupParent).some((name) =>
          existsSync(path.join(backupParent, name, "manifest.json")),
        )
      ) {
        changed = true;
        if (change === "permissions") chmodSync(file, 0o444);
        else {
          unlinkSync(file);
          mkdirSync(file);
        }
      }
      return true;
    };
    try {
      await expect(
        commitRepairFiles({
          root,
          stage,
          before,
          backupParent,
          signal: new AbortController().signal,
          isCurrent,
        }),
      ).rejects.toThrow("適用直前に変更");
      expect(changed).toBe(true);
      if (change === "permissions") {
        expect(readFileSync(file, "utf8")).toBe("old");
        expect(lstatSync(file).mode & 0o777).toBe(0o444);
      } else expect(lstatSync(file).isDirectory()).toBe(true);
    } finally {
      if (change === "permissions") chmodSync(file, 0o666);
    }
  },
);

it.each([new Error("apply failure"), "apply failure", 42, null])(
  "preserves concurrent permissions on rollback and reports the original failure (%s)",
  async (failure) => {
    const root = await temporary(),
      stage = await temporary(),
      backupParent = await temporary();
    const file = path.join(root, ".gitignore");
    writeFileSync(file, "old ignore");
    chmodSync(file, 0o666);
    writeFileSync(path.join(root, "AGENTS.md"), "old agents");
    const before = snapshotRepairFiles(root);
    seedRepairFiles(stage, before);
    writeFileSync(path.join(stage, ".gitignore"), "new ignore");
    writeFileSync(path.join(stage, "AGENTS.md"), "new agents");
    const isCurrent = () => {
      if (readFileSync(file, "utf8") === "new ignore") {
        chmodSync(file, 0o444);
        throw failure;
      }
      return true;
    };
    try {
      const error = await commitRepairFiles({
        root,
        stage,
        before,
        backupParent,
        signal: new AbortController().signal,
        isCurrent,
      }).catch((error) => error);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain(
        `${failure instanceof Error ? failure.message : String(failure)}\n復元できない設定があります: .gitignore`,
      );
      expect(error.message).toContain(backupParent);
      expect(error.cause).toBe(failure);
      expect(readFileSync(file, "utf8")).toBe("new ignore");
      expect(lstatSync(file).mode & 0o777).toBe(0o444);
      expect(readFileSync(path.join(root, "AGENTS.md"), "utf8")).toBe("old agents");
      const backup = path.join(backupParent, readdirSync(backupParent)[0] ?? "");
      expect(readFileSync(path.join(backup, "0.bin"), "utf8")).toBe("old ignore");
      expect(existsSync(path.join(backup, "completed"))).toBe(false);
    } finally {
      chmodSync(file, 0o666);
    }
  },
);
