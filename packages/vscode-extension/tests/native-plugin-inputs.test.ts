import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCandidatePlugins, capturePluginInputs } from "../src/native-plugin-inputs.ts";
import type { NativeInstall, SetupRunner } from "../src/native-setup.ts";

const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const hash = (value: string | Buffer) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
async function write(root: string, relative: string, value: unknown) {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, typeof value === "string" ? value : JSON.stringify(value));
}
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "aidlc-plugin-inputs-"));
  roots.push(root);
  const project = path.join(root, "project");
  const candidate = path.join(root, "candidate");
  await mkdir(project);
  await mkdir(candidate);
  const install: NativeInstall = {
    executable: path.join(root, "versions", "2.8.1", "aidlc"),
    version: "2.8.1",
    binDir: path.join(root, "bin"),
  };
  return { root, project, candidate, install };
}
async function packageAt(root: string, harness: "claude" | "cursor", body = `${harness} plugin\n`) {
  await write(root, `.${harness}-plugin/plugin.json`, { name: "aidlc-test-pro", version: "0.1.0" });
  await write(root, "stages/check.md", body);
  await write(root, "hooks/compose.ts", "export function compose() {}\n");
  return hash(`stages/check.md\0${body.replace(/\r\n?/g, "\n")}`);
}
async function sourceState(
  project: string,
  harness: "claude" | "cursor",
  selected: string[] | undefined,
  sourceHash?: string,
) {
  const data = `.${harness}/tools/data`;
  await write(project, `.${harness}/skills/aidlc/SKILL.md`, "AI-DLC\n");
  await write(
    project,
    `.${harness}/tools/aidlc-version.ts`,
    'export const AIDLC_VERSION = "2.8.0";\n',
  );
  await write(project, `${data}/harness.json`, {
    harnessDir: `.${harness}`,
    ...(selected ? { plugins: selected } : {}),
  });
  await write(project, `${data}/aidlc-stamp.json`, { frameworkVersion: "2.8.0" });
  await write(
    project,
    `${data}/stage-graph.json`,
    sourceHash ? [{ slug: "check", plugin: "test-pro" }] : [],
  );
  if (sourceHash)
    await write(project, `${data}/plugin-compose-test-pro.json`, {
      schemaVersion: 1,
      name: "test-pro",
      version: "0.1.0",
      sourceHash,
    });
}
async function baseline(candidate: string) {
  await write(candidate, ".cursor/tools/data/aidlc-manifest.json", {
    files: {
      ".cursor/skills/aidlc/SKILL.md": hash("original"),
      ".cursor/skills/retired/SKILL.md": hash("retired"),
    },
  });
  await write(candidate, ".cursor/skills/aidlc/SKILL.md", "original");
  await write(candidate, ".cursor/skills/retired/SKILL.md", "retired");
}

describe("plugin inputs for another harness", () => {
  it("leaves an unselected core-only project on the ordinary candidate path", async () => {
    const { project, candidate, install } = await fixture();
    await sourceState(project, "claude", undefined);
    const inputs = await capturePluginInputs(project, "cursor", install);
    const runner = vi.fn<SetupRunner>();

    await applyCandidatePlugins(install, candidate, "cursor", inputs, runner);

    expect(inputs.selected).toBeNull();
    expect(inputs.packages).toEqual([]);
    expect(runner).not.toHaveBeenCalled();
  });

  it("replays explicit selection, refreshes changed/deleted baseline rows, and drops only candidate scratch", async () => {
    const { project, candidate, install } = await fixture();
    await sourceState(project, "claude", ["aidlc"]);
    const inputs = await capturePluginInputs(project, "cursor", install);
    await baseline(candidate);
    await write(candidate, "aidlc/spaces/default/memory/team.md", "Our method");
    vi.stubEnv("CLAUDE_PLUGIN_ROOT", "do-not-use-ambient-plugin");
    const runner = vi.fn<SetupRunner>(async (_exe, _args, _cwd, env) => {
      expect(env?.CLAUDE_PLUGIN_ROOT).toBeUndefined();
      expect(env?.AIDLC_HARNESS_NAME).toBe("cursor");
      await write(candidate, ".cursor/skills/aidlc/SKILL.md", "regenerated");
      await rm(path.join(candidate, ".cursor/skills/retired/SKILL.md"));
      await write(
        candidate,
        "aidlc/spaces/default/intents/.aidlc-hooks-health.md",
        "candidate audit",
      );
      return { code: 0, stdout: "", stderr: "" };
    });

    await applyCandidatePlugins(install, candidate, "cursor", inputs, runner);

    expect(runner.mock.calls[0]?.[1]).toEqual([
      "engine",
      "plugin",
      "select",
      "aidlc",
      "--project-dir",
      candidate,
    ]);
    const manifest = JSON.parse(
      await readFile(path.join(candidate, ".cursor/tools/data/aidlc-manifest.json"), "utf8"),
    );
    expect(manifest.files).toEqual({ ".cursor/skills/aidlc/SKILL.md": hash("regenerated") });
    expect(
      await readFile(path.join(candidate, "aidlc/spaces/default/memory/team.md"), "utf8"),
    ).toBe("Our method");
    await expect(
      readFile(path.join(candidate, "aidlc/spaces/default/intents/.aidlc-hooks-health.md")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("replays exact retained plugin content through the target projection across a core upgrade", async () => {
    const { root, project, candidate, install } = await fixture();
    const original = path.join(root, "versions/2.8.0/plugins/test-pro/claude");
    const destination = path.join(root, "versions/2.8.0/plugins/test-pro/cursor");
    const originalHash = await packageAt(original, "claude");
    const targetHash = await packageAt(destination, "cursor");
    await sourceState(project, "claude", ["test-pro"], originalHash);
    const inputs = await capturePluginInputs(project, "cursor", install);
    await baseline(candidate);
    const runner = vi.fn<SetupRunner>(async (_exe, args, _cwd, env) => {
      if (args[2] === "sync") {
        expect(env?.AIDLC_PLUGIN_ROOT).toBe(destination);
        await write(candidate, ".cursor/tools/data/plugin-compose-test-pro.json", {
          schemaVersion: 1,
          name: "test-pro",
          version: "0.1.0",
          sourceHash: targetHash,
        });
      }
      return { code: 0, stdout: "", stderr: "" };
    });

    await applyCandidatePlugins(install, candidate, "cursor", inputs, runner);

    expect(originalHash).not.toBe(targetHash);
    expect(inputs.packages[0]?.root).toBe(destination);
    expect(runner.mock.calls.map((call) => call[1]?.slice(1, 3))).toEqual([
      ["plugin", "sync"],
      ["plugin", "select"],
    ]);
  });

  it("accepts verified project-emitted plugin packages", async () => {
    const { project, install } = await fixture();
    const sourceHash = await packageAt(
      path.join(project, "plugins/test-pro/dist/claude"),
      "claude",
    );
    const destination = path.join(project, "plugins/test-pro/dist/cursor");
    await packageAt(destination, "cursor");
    await sourceState(project, "claude", undefined, sourceHash);

    const inputs = await capturePluginInputs(project, "cursor", install);

    expect(inputs.packages[0]?.root).toBe(destination);
  });

  it("refuses a composed plugin with unavailable source instead of dropping its stages", async () => {
    const { project, install } = await fixture();
    await sourceState(project, "claude", undefined, hash("missing source"));

    await expect(capturePluginInputs(project, "cursor", install)).rejects.toThrow(
      "元パッケージまたは cursor 向け出力が見つかりません",
    );
  });

  it("refuses legacy stages without a composition stamp", async () => {
    const { project, install } = await fixture();
    await sourceState(project, "claude", undefined);
    await write(project, ".claude/tools/data/stage-graph.json", [{ plugin: "test-pro" }]);

    await expect(capturePluginInputs(project, "cursor", install)).rejects.toThrow(
      "元パッケージを証明する構成記録がありません",
    );
  });

  it("does not silently pick a selection when installed tools disagree", async () => {
    const { project, install } = await fixture();
    await sourceState(project, "claude", ["aidlc"]);
    await sourceState(project, "cursor", undefined);

    await expect(capturePluginInputs(project, "codex", install)).rejects.toThrow(
      "既存ツール間でプラグインの選択または版が異なります",
    );
    expect((await capturePluginInputs(project, "cursor", install)).selected).toBeNull();
  });

  it("binds selection and complete plugin source bytes into the preview fingerprint", async () => {
    const { root, project, install } = await fixture();
    const sourceHash = await packageAt(
      path.join(root, "versions/2.8.0/plugins/test-pro/claude"),
      "claude",
    );
    const destination = path.join(root, "versions/2.8.0/plugins/test-pro/cursor");
    await packageAt(destination, "cursor");
    await sourceState(project, "claude", undefined, sourceHash);
    const before = await capturePluginInputs(project, "cursor", install);
    await write(destination, "hooks/compose.ts", "changed hook");
    const after = await capturePluginInputs(project, "cursor", install);

    expect(after.hash).not.toBe(before.hash);
    await expect(
      applyCandidatePlugins(install, project, "cursor", before, vi.fn()),
    ).rejects.toThrow("元パッケージが確認後に変更されました");
  });

  it("rejects native replay failures and mismatched composition receipts", async () => {
    const { root, project, candidate, install } = await fixture();
    const sourceHash = await packageAt(
      path.join(root, "versions/2.8.0/plugins/test-pro/claude"),
      "claude",
    );
    await packageAt(path.join(root, "versions/2.8.0/plugins/test-pro/cursor"), "cursor");
    await sourceState(project, "claude", undefined, sourceHash);
    const inputs = await capturePluginInputs(project, "cursor", install);

    await expect(
      applyCandidatePlugins(install, candidate, "cursor", inputs, async () => ({
        code: 1,
        stdout: "",
        stderr: "compose refused",
      })),
    ).rejects.toThrow("compose refused");
    await expect(
      applyCandidatePlugins(install, candidate, "cursor", inputs, async () => ({
        code: 0,
        stdout: "",
        stderr: "",
      })),
    ).rejects.toThrow("再構成結果が元パッケージと一致しません");
  });
});
