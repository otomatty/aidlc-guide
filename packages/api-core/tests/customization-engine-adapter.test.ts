import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { createCustomizationEngine } from "../src/customization/engine-adapter";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it("refuses an engine reached through a linked parent before starting Bun", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "customization-engine-path-"));
  roots.push(root);
  const project = path.join(root, "project");
  const external = path.join(root, "external");
  await mkdir(project);
  await mkdir(path.join(external, "tools"), { recursive: true });
  await writeFile(
    path.join(external, "tools/aidlc-customization.ts"),
    'throw new Error("must never execute");',
  );
  await symlink(
    external,
    path.join(project, ".claude"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await expect(
    createCustomizationEngine(project).call("catalog", { schemaVersion: 1 }),
  ).rejects.toMatchObject({ code: "external-settings-root" });
});
