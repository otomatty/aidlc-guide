import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const workflow = readFileSync(
  join(import.meta.dirname, "../.github/workflows/aidlc-workflows-docs-update.yml"),
  "utf8",
);
const addPaths = workflow
  .match(/^ {10}add-paths: \|\r?\n((?:^ {12}.+\r?\n)+)/m)?.[1]
  ?.trim()
  .split(/\r?\n/)
  .map((line) => line.trim());
if (!addPaths?.length) throw new Error("docs sync workflow has no literal add-paths list");

const fixtures: string[] = [];
afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "docs-sync-staging-"));
  fixtures.push(root);
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "core.autocrlf=false", ...args], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: join(root, "empty-gitconfig"),
      },
    }).trim();
  const write = (file: string, body = "initial\n") => {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeFileSync(join(root, file), body);
  };
  git("init", "--quiet");
  write("docs/guide/en/intro.md");
  write("packages/docs-bridge/data/artifact-map.json", "{}\n");
  git("add", ".");
  return { root, git, write };
}

describe("docs sync PR staging", () => {
  it("stages the snapshot when RFCs and other optional directories are absent", () => {
    const { git, write } = fixture();
    write("docs/guide/en/intro.md", "updated\n");
    git("add", "--", ...addPaths);
    expect(git("show", ":docs/guide/en/intro.md")).toBe("updated");
  });

  it("stages deleted sections and newly created directories", () => {
    const { root, git, write } = fixture();
    write("docs/rfcs/en/old.md");
    git("add", ".");
    rmSync(join(root, "docs/rfcs"), { recursive: true });
    write("docs/new-section/en/new.md");
    git("add", "--", ...addPaths);
    expect(git("ls-files", "docs/rfcs")).toBe("");
    expect(git("show", ":docs/new-section/en/new.md")).toBe("initial");
  });

  it("includes generated metadata and the artifact map but excludes unrelated outputs", () => {
    const { git, write } = fixture();
    write("docs/official-docs.manifest.json", "{}\n");
    write("docs/official-docs.index.json", "{}\n");
    write("docs/reviews/sync.md");
    write("packages/docs-bridge/data/artifact-map.json", '{"updated":true}\n');
    write("bun.lock");
    write("coverage/report.json");
    write("packages/unrelated/output.ts");
    git("add", "--", ...addPaths);
    expect(git("ls-files").split("\n")).toEqual([
      "docs/guide/en/intro.md",
      "docs/official-docs.index.json",
      "docs/official-docs.manifest.json",
      "docs/reviews/sync.md",
      "packages/docs-bridge/data/artifact-map.json",
    ]);
    expect(git("show", ":packages/docs-bridge/data/artifact-map.json")).toBe('{"updated":true}');
  });
});
