import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isGitRepository } from "../src/git-prerequisite.ts";

const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const git = (...args: string[]) => execFileSync("git", args, { windowsHide: true, stdio: "pipe" });

describe("Codex Git prerequisite", () => {
  // Several real Git processes share this test's budget; coverage runs contend with other suites.
  it("recognizes initialized repositories, nested folders and linked worktrees", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-git-"));
    roots.push(root);
    const repo = path.join(root, "project with spaces");
    await mkdir(repo);
    expect(await isGitRepository(repo)).toBe(false);
    git("init", repo);
    expect(await isGitRepository(repo)).toBe(true);
    const nested = path.join(repo, "package");
    await mkdir(nested);
    expect(await isGitRepository(nested)).toBe(true);
    git(
      "-C",
      repo,
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "-m",
      "fixture",
    );
    const worktree = path.join(root, "linked-worktree");
    git("-C", repo, "worktree", "add", "--detach", worktree);
    expect(await isGitRepository(worktree)).toBe(true);
    const bare = path.join(root, "bare");
    git("init", "--bare", bare);
    expect(await isGitRepository(bare)).toBe(false);
    vi.stubEnv("GIT_DIR", path.join(repo, ".git"));
    vi.stubEnv("GIT_WORK_TREE", repo);
    expect(await isGitRepository(root)).toBe(false);
  }, 20_000);
});
