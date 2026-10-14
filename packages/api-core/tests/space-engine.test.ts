import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createSpaceEngine } from "../src/spaces/engine.ts";

let root: string;
beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), "guide-space-engine-")); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

it("runs the official utility with a Guide session and repoints only the selected tool", async () => {
  const utility = new URL("../../../.claude/tools/aidlc-utility.ts", import.meta.url).href;
  for (const harness of [".claude", ".cursor"]) {
    await mkdir(path.join(root, harness, "tools"), { recursive: true });
    await writeFile(path.join(root, harness, "tools/aidlc-utility.ts"), `import { main } from ${JSON.stringify(utility)}; await main(process.argv.slice(2));`);
    await mkdir(path.join(root, harness, "rules"));
  }
  const original = "@../../aidlc/spaces/default/memory/org.md\n";
  await writeFile(path.join(root, ".claude/rules/aidlc.md"), original);
  await writeFile(path.join(root, ".cursor/rules/aidlc-core.mdc"), "Read aidlc/spaces/default/memory/org.md\n");
  for (const space of ["default", "team-b"]) await mkdir(path.join(root, "aidlc/spaces", space, "intents"), { recursive: true });
  const engine = createSpaceEngine(root);
  expect(await engine.harnesses()).toEqual([{ id: ".cursor", label: "Cursor" }, { id: ".claude", label: "Claude Code" }]);
  await engine.switch("team-b", ".claude");
  expect((await readFile(path.join(root, "aidlc/active-space"), "utf8")).trim()).toBe("team-b");
  expect(await readFile(path.join(root, ".claude/rules/aidlc.md"), "utf8")).toContain("spaces/team-b/memory");
  expect(await readFile(path.join(root, ".cursor/rules/aidlc-core.mdc"), "utf8")).toContain("spaces/default/memory");
  const sessions = await readdir(path.join(root, "aidlc/.aidlc-sessions"));
  expect(sessions.some((name) => name.startsWith("aidlc-guide-"))).toBe(true);
  await engine.switch("default", ".claude");
  expect(await readFile(path.join(root, ".claude/rules/aidlc.md"), "utf8")).toBe(original);
});

it("refuses an arbitrary executable path before starting a process", async () => {
  await expect(createSpaceEngine(root).switch("default", "../outside")).rejects.toThrow();
  expect(await createSpaceEngine(root).harnesses()).toEqual([]);
});

it("refuses names that the official utility would change", async () => {
  const engine = createSpaceEngine(root);
  for (const name of ["Team.B", "team_b", "team--b", "1team", "a".repeat(49)])
    await expect(engine.switch(name, ".claude")).rejects.toThrow("Space 名");
});
