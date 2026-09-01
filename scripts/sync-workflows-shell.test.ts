import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyShellSync,
  formatShellPrBody,
  HARNESSES,
  planShellSync,
  readShellVersion,
  runCli,
  type ShellPlan,
  staleManagedFiles,
  walkShellFiles,
} from "./sync-workflows-shell.ts";

function write(root: string, rel: string, body: string): void {
  const abs = join(root, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, body);
}

const UPSTREAM_SHELL = "dist/claude/.claude";
const UPSTREAM_CURSOR = "dist/cursor/.cursor";

/** One harness tree, upstream-side or workspace-side. */
function writeTree(root: string, rel: string, version: string): void {
  write(root, `${rel}/tools/aidlc-version.ts`, `export const AIDLC_VERSION = "${version}";\n`);
  write(root, `${rel}/aidlc-common/stages/ideation/intent-capture.md`, "# intent\n");
  write(root, `${rel}/agents/aidlc-product-agent.md`, "# product\n");
  write(root, `${rel}/tools/data/templates/.gitkeep`, "");
  write(root, `${rel}/settings.json`, "{}\n");
}

/**
 * An upstream checkout carrying BOTH harness trees. cursorVersion defaults to
 * the same value, because the interesting case is when it does not.
 */
function seedUpstream(version = "2.7.0", cursorVersion = version): string {
  const root = mkdtempSync(join(tmpdir(), "shell-upstream-"));
  writeTree(root, UPSTREAM_SHELL, version);
  writeTree(root, UPSTREAM_CURSOR, cursorVersion);
  return root;
}

/** A workspace whose harness trees match those shells exactly. */
function seedWorkspace(version = "2.6.124"): string {
  const root = mkdtempSync(join(tmpdir(), "shell-workspace-"));
  for (const rel of [".claude", ".cursor"]) {
    writeTree(root, rel, version);
    write(root, `${rel}/scopes/aidlc-prd-implementation.md`, "# local scope\n");
  }
  // Cursor-only: the repo-authored test that pins the local adapter patch, and
  // the installer manifest recording upstream's hashes.
  write(root, ".cursor/hooks/aidlc-cursor-adapter.test.ts", "// pins the local patch\n");
  write(
    root,
    ".cursor/aidlc-install.json",
    JSON.stringify({
      schemaVersion: 1,
      managedFiles: { ".cursor/tools/aidlc-version.ts": "recorded-upstream-hash" },
    }),
  );
  return root;
}

const SHA = "96b11d39028955d4f92375e783525db5275cdfd8";

const CLAUDE = HARNESSES.find((harness) => harness.id === "claude");
const CURSOR = HARNESSES.find((harness) => harness.id === "cursor");
if (CLAUDE === undefined || CURSOR === undefined) throw new Error("harness table changed");

/**
 * Same probe as sync-official-docs.test.ts, and for the same reason: an
 * unportable name is by definition one some supported OS cannot carry, so the
 * end-to-end refusal can only be staged where such a file exists. The write has
 * to be read back — on NTFS `a:b.md` silently creates file `a` with an alternate
 * data stream, so it succeeds without ever producing that name.
 *
 * A case clash would be the other way to trip the same check, but it is worse
 * here: it can only be staged on a case-SENSITIVE filesystem, which skips macOS
 * as well as Windows. `unportablePaths` itself is pure and covered directly
 * over both classes in sync-official-docs.test.ts; what this case adds is the
 * wiring, so it should run on as many platforms as it can.
 */
const canUnportableName = ((): boolean => {
  try {
    const probe = mkdtempSync(join(tmpdir(), "shell-unportable-probe-"));
    writeFileSync(join(probe, "a:b.md"), "x");
    return readdirSync(probe).includes("a:b.md");
  } catch {
    return false;
  }
})();

describe("walkShellFiles", () => {
  it("keeps dotfiles, which the docs walker deliberately drops", () => {
    const root = join(seedUpstream(), UPSTREAM_SHELL);
    expect([...walkShellFiles(root).keys()]).toContain("tools/data/templates/.gitkeep");
  });

  it("returns an empty map for an absent root", () => {
    expect(walkShellFiles(join(tmpdir(), "shell-does-not-exist-1a2b3c")).size).toBe(0);
  });

  it("never follows a symlink, and refuses a symlinked root", () => {
    const base = mkdtempSync(join(tmpdir(), "shell-symlink-"));
    const root = join(base, "shell");
    write(base, "shell/settings.json", "{}\n");
    write(base, "secret.txt", "secret\n");
    symlinkSync(join(base, "secret.txt"), join(root, "leak.md"));
    expect([...walkShellFiles(root).keys()]).toEqual(["settings.json"]);

    const linkedRoot = join(base, "linked");
    symlinkSync(root, linkedRoot);
    expect(() => walkShellFiles(linkedRoot)).toThrow(/must not be a symlink/);
  });

  it("skips a vendored node_modules rather than mirroring it", () => {
    const base = mkdtempSync(join(tmpdir(), "shell-nm-"));
    write(base, "shell/settings.json", "{}\n");
    write(base, "shell/node_modules/pkg/index.js", "module.exports = 1;\n");
    expect([...walkShellFiles(join(base, "shell")).keys()]).toEqual(["settings.json"]);
  });
});

describe("planShellSync", () => {
  const up = new Map([
    ["settings.json", "hash-a"],
    ["agents/new.md", "hash-b"],
    ["tools/changed.ts", "hash-new"],
  ]);
  const local = new Map([
    ["settings.json", "hash-a"],
    ["tools/changed.ts", "hash-old"],
    ["agents/gone.md", "hash-c"],
    ["scopes/aidlc-prd-implementation.md", "hash-d"],
    ["settings.local.json", "hash-e"],
  ]);

  it("writes what differs, deletes what upstream dropped, keeps what this repo owns", () => {
    const plan = planShellSync(up, local, CLAUDE.localOnly, CLAUDE.ignored);
    expect(plan.writes).toEqual(["agents/new.md", "tools/changed.ts"]);
    expect(plan.overwrites).toEqual(["tools/changed.ts"]);
    expect(plan.deletes).toEqual(["agents/gone.md"]);
    expect(plan.preserved).toEqual(["scopes/aidlc-prd-implementation.md"]);
  });

  it("leaves the gitignored per-user settings alone in both directions", () => {
    const plan = planShellSync(up, local, CLAUDE.localOnly, CLAUDE.ignored);
    expect(plan.deletes).not.toContain("settings.local.json");
    expect(plan.writes).not.toContain("settings.local.json");
    expect(CLAUDE.ignored.has("settings.local.json")).toBe(true);
  });

  it("keeps a locally owned path even if upstream starts publishing one there", () => {
    const collision = new Map([...up, ["scopes/aidlc-prd-implementation.md", "hash-upstream"]]);
    const plan = planShellSync(collision, local, CLAUDE.localOnly, CLAUDE.ignored);
    expect(plan.writes).not.toContain("scopes/aidlc-prd-implementation.md");
    expect(plan.preserved).toEqual(["scopes/aidlc-prd-implementation.md"]);
    expect(CLAUDE.localOnly.has("scopes/aidlc-prd-implementation.md")).toBe(true);
  });

  it("plans nothing when the trees already agree", () => {
    const plan = planShellSync(up, new Map(up), CLAUDE.localOnly, CLAUDE.ignored);
    expect(plan.writes).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });
});

describe("applyShellSync", () => {
  it("deletes before writing, so a directory replaced by a file still lands", () => {
    const upstreamRoot = mkdtempSync(join(tmpdir(), "shell-apply-up-"));
    const workspace = mkdtempSync(join(tmpdir(), "shell-apply-ws-"));
    // Upstream turned the directory `tools/data/` into a file named `data`.
    write(upstreamRoot, "data", "now a file\n");
    write(workspace, ".claude/data/old.txt", "was a directory\n");
    const plan: ShellPlan = {
      writes: ["data"],
      overwrites: [],
      deletes: ["data/old.txt"],
      preserved: [],
    };
    applyShellSync({
      workspaceRoot: workspace,
      upstreamShellRoot: upstreamRoot,
      localRel: ".claude",
      plan,
    });
    expect(readFileSync(join(workspace, ".claude/data"), "utf8")).toBe("now a file\n");
  });

  it("refuses a path that would escape the shell tree", () => {
    const upstreamRoot = mkdtempSync(join(tmpdir(), "shell-escape-up-"));
    const workspace = mkdtempSync(join(tmpdir(), "shell-escape-ws-"));
    write(workspace, "outside.txt", "keep me\n");
    expect(() =>
      applyShellSync({
        workspaceRoot: workspace,
        upstreamShellRoot: upstreamRoot,
        localRel: ".claude",
        plan: { writes: [], overwrites: [], deletes: ["../outside.txt"], preserved: [] },
      }),
    ).toThrow(/escapes the tree/);
    expect(existsSync(join(workspace, "outside.txt"))).toBe(true);
  });
});

describe("readShellVersion", () => {
  it("reads AIDLC_VERSION, and returns null when the file is absent or unparseable", () => {
    const root = join(seedUpstream("2.7.0"), UPSTREAM_SHELL);
    expect(readShellVersion(root)).toBe("2.7.0");
    expect(readShellVersion(mkdtempSync(join(tmpdir(), "shell-noversion-")))).toBeNull();
  });
});

describe("formatShellPrBody", () => {
  it("names the version move, the label decision and the files it overwrote", () => {
    const body = formatShellPrBody({
      version: "2.7.0",
      previousVersion: "2.6.124",
      upstreamSha: SHA,
      results: [
        {
          harness: CLAUDE,
          plan: {
            writes: ["tools/aidlc-version.ts"],
            overwrites: ["tools/aidlc-version.ts"],
            deletes: [],
            preserved: ["scopes/aidlc-prd-implementation.md"],
          },
          staleManaged: [],
        },
      ],
    });
    expect(body).toContain("| AIDLC_VERSION | 2.6.124 | 2.7.0 |");
    expect(body).toContain("release:skip");
    expect(body).toContain("`tools/aidlc-version.ts`");
    expect(body).toContain("/HEAD/CHANGELOG.md");
  });

  it("caps a long file list rather than pasting hundreds of paths", () => {
    const many = Array.from({ length: 25 }, (_, i) => `agents/agent-${i}.md`);
    const body = formatShellPrBody({
      version: "2.7.0",
      previousVersion: null,
      upstreamSha: SHA,
      results: [
        {
          harness: CURSOR,
          plan: { writes: many, overwrites: many, deletes: [], preserved: [] },
          staleManaged: [],
        },
      ],
    });
    expect(body).toContain("ほか 5 件");
    expect(body).toContain("_(none)_");
  });
});

describe("runCli", () => {
  it("mirrors the shell, preserves the local scope and reports the move", () => {
    const upstream = seedUpstream();
    const workspace = seedWorkspace();
    write(workspace, ".claude/agents/aidlc-retired-agent.md", "# retired\n");
    const prBody = join(mkdtempSync(join(tmpdir(), "shell-body-")), "body.md");

    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      SHA,
      "--workspace",
      workspace,
      "--pr-body",
      prBody,
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("version=2.7.0");
    expect(result.stdout).toContain("previous_version=2.6.124");
    expect(result.stdout).toContain("changed=true");
    expect(readFileSync(join(workspace, ".claude/tools/aidlc-version.ts"), "utf8")).toContain(
      "2.7.0",
    );
    // Deleted upstream, so gone here.
    expect(existsSync(join(workspace, ".claude/agents/aidlc-retired-agent.md"))).toBe(false);
    // Owned here, so untouched.
    expect(existsSync(join(workspace, ".claude/scopes/aidlc-prd-implementation.md"))).toBe(true);
    expect(readFileSync(prBody, "utf8")).toContain("2.7.0");
  });

  it("reports changed=false and writes nothing when the shell is already current", () => {
    const upstream = seedUpstream();
    const workspace = seedWorkspace("2.7.0");
    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      SHA,
      "--workspace",
      workspace,
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("changed=false");
    expect(result.stdout).toContain("written=0");
    expect(result.stdout).toContain("deleted=0");
  });

  it("refuses an empty shell rather than deleting the whole tree", () => {
    const upstream = mkdtempSync(join(tmpdir(), "shell-empty-"));
    const workspace = seedWorkspace();
    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      SHA,
      "--workspace",
      workspace,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no shell files");
    expect(existsSync(join(workspace, ".claude/settings.json"))).toBe(true);
  });

  it("refuses a shell whose version file cannot be read", () => {
    const upstream = mkdtempSync(join(tmpdir(), "shell-noversion-up-"));
    write(upstream, `${UPSTREAM_SHELL}/settings.json`, "{}\n");
    const workspace = seedWorkspace();
    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      SHA,
      "--workspace",
      workspace,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("AIDLC_VERSION");
    expect(existsSync(join(workspace, ".claude/settings.json"))).toBe(true);
  });

  it.skipIf(!canUnportableName)("refuses a tree that a supported OS could not check out", () => {
    const upstream = seedUpstream();
    write(upstream, `${UPSTREAM_SHELL}/agents/a:b.md`, "# colon\n");
    const workspace = seedWorkspace();
    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      SHA,
      "--workspace",
      workspace,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not portable");
    // Refused before touching anything: the shell it would have mirrored over
    // is still the workspace's own.
    expect(readFileSync(join(workspace, ".claude/tools/aidlc-version.ts"), "utf8")).toContain(
      "2.6.124",
    );
  });

  it("prints usage when a required flag is missing or takes no value", () => {
    expect(runCli([]).stderr).toContain("Usage:");
    expect(runCli(["--upstream", "/tmp"]).stderr).toContain("Usage:");
    expect(runCli(["--upstream", "--upstream-sha"]).stderr).toContain("Usage:");
  });
});

describe("staleManagedFiles", () => {
  const manifest = JSON.stringify({
    schemaVersion: 1,
    managedFiles: {
      ".cursor/hooks/aidlc-cursor-adapter.ts": "hash-a",
      ".cursor/tools/aidlc-version.ts": "hash-b",
    },
  });

  it("reports only the changed files the manifest actually manages", () => {
    expect(
      staleManagedFiles(manifest, ".cursor", ["tools/aidlc-version.ts", "agents/not-managed.md"]),
    ).toEqual([".cursor/tools/aidlc-version.ts"]);
  });

  it("reports nothing when the mirror changed nothing it manages", () => {
    expect(staleManagedFiles(manifest, ".cursor", [])).toEqual([]);
    expect(staleManagedFiles(manifest, ".cursor", ["agents/other.md"])).toEqual([]);
  });

  it("degrades to empty on a manifest it cannot read", () => {
    expect(staleManagedFiles("not json", ".cursor", ["tools/aidlc-version.ts"])).toEqual([]);
    expect(staleManagedFiles("{}", ".cursor", ["tools/aidlc-version.ts"])).toEqual([]);
  });
});

describe("runCli — both harnesses", () => {
  it("mirrors .claude and .cursor together and preserves each tree's own files", () => {
    const upstream = seedUpstream();
    const workspace = seedWorkspace();
    const prBody = join(mkdtempSync(join(tmpdir(), "shell-both-")), "body.md");

    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      SHA,
      "--workspace",
      workspace,
      "--pr-body",
      prBody,
    ]);

    expect(result.status).toBe(0);
    // Both trees moved, and to the same version.
    for (const rel of [".claude", ".cursor"]) {
      expect(readFileSync(join(workspace, rel, "tools/aidlc-version.ts"), "utf8")).toContain(
        "2.7.0",
      );
    }
    expect(result.stdout).toContain("claude_written=1");
    expect(result.stdout).toContain("cursor_written=1");
    // Cursor's own three local-only files survive.
    expect(existsSync(join(workspace, ".cursor/aidlc-install.json"))).toBe(true);
    expect(existsSync(join(workspace, ".cursor/hooks/aidlc-cursor-adapter.test.ts"))).toBe(true);
    expect(existsSync(join(workspace, ".cursor/scopes/aidlc-prd-implementation.md"))).toBe(true);
  });

  it("reports the installer manifest as stale rather than rewriting it", () => {
    const upstream = seedUpstream();
    const workspace = seedWorkspace();
    const before = readFileSync(join(workspace, ".cursor/aidlc-install.json"), "utf8");
    const prBody = join(mkdtempSync(join(tmpdir(), "shell-stale-")), "body.md");

    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      SHA,
      "--workspace",
      workspace,
      "--pr-body",
      prBody,
    ]);

    expect(result.stdout).toContain("stale_manifests=1");
    // Untouched: it records upstream's hashes, which is how the installer spots
    // a hand-edited file. Regenerating it here would erase that signal.
    expect(readFileSync(join(workspace, ".cursor/aidlc-install.json"), "utf8")).toBe(before);
    expect(readFileSync(prBody, "utf8")).toContain("aidlc-install.json");
  });

  it("refuses to split lockstep when upstream ships the harnesses at different versions", () => {
    const upstream = seedUpstream("2.7.0", "2.6.124");
    const workspace = seedWorkspace();

    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      SHA,
      "--workspace",
      workspace,
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("refusing to split lockstep");
    // Nothing was written: both trees are planned before either is applied, so
    // the repository is never left half-upgraded.
    for (const rel of [".claude", ".cursor"]) {
      expect(readFileSync(join(workspace, rel, "tools/aidlc-version.ts"), "utf8")).toContain(
        "2.6.124",
      );
    }
  });

  it("refuses when either harness tree is missing from the checkout", () => {
    const upstream = seedUpstream();
    rmSync(join(upstream, UPSTREAM_CURSOR), { recursive: true, force: true });
    const workspace = seedWorkspace();

    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      SHA,
      "--workspace",
      workspace,
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no shell files");
    // .claude must not have moved either, even though its tree was fine.
    expect(readFileSync(join(workspace, ".claude/tools/aidlc-version.ts"), "utf8")).toContain(
      "2.6.124",
    );
  });
});
