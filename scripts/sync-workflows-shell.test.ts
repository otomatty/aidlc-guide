import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyShellSync,
  formatShellPrBody,
  IGNORED_SHELL_PATHS,
  LOCAL_ONLY_SHELL_PATHS,
  planShellSync,
  readShellVersion,
  runCli,
  type ShellPlan,
  walkShellFiles,
} from "./sync-workflows-shell.ts";

function write(root: string, rel: string, body: string): void {
  const abs = join(root, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, body);
}

const UPSTREAM_SHELL = "dist/claude/.claude";

/** An upstream checkout carrying a minimal but complete shell. */
function seedUpstream(version = "2.7.0"): string {
  const root = mkdtempSync(join(tmpdir(), "shell-upstream-"));
  write(
    root,
    `${UPSTREAM_SHELL}/tools/aidlc-version.ts`,
    `export const AIDLC_VERSION = "${version}";\n`,
  );
  write(root, `${UPSTREAM_SHELL}/aidlc-common/stages/ideation/intent-capture.md`, "# intent\n");
  write(root, `${UPSTREAM_SHELL}/agents/aidlc-product-agent.md`, "# product\n");
  write(root, `${UPSTREAM_SHELL}/tools/data/templates/.gitkeep`, "");
  write(root, `${UPSTREAM_SHELL}/settings.json`, "{}\n");
  return root;
}

/** A workspace whose `.claude/` matches that shell exactly. */
function seedWorkspace(version = "2.6.124"): string {
  const root = mkdtempSync(join(tmpdir(), "shell-workspace-"));
  write(root, ".claude/tools/aidlc-version.ts", `export const AIDLC_VERSION = "${version}";\n`);
  write(root, ".claude/aidlc-common/stages/ideation/intent-capture.md", "# intent\n");
  write(root, ".claude/agents/aidlc-product-agent.md", "# product\n");
  write(root, ".claude/tools/data/templates/.gitkeep", "");
  write(root, ".claude/settings.json", "{}\n");
  write(root, ".claude/scopes/aidlc-prd-implementation.md", "# local scope\n");
  return root;
}

const SHA = "96b11d39028955d4f92375e783525db5275cdfd8";

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
    const plan = planShellSync(up, local);
    expect(plan.writes).toEqual(["agents/new.md", "tools/changed.ts"]);
    expect(plan.overwrites).toEqual(["tools/changed.ts"]);
    expect(plan.deletes).toEqual(["agents/gone.md"]);
    expect(plan.preserved).toEqual(["scopes/aidlc-prd-implementation.md"]);
  });

  it("leaves the gitignored per-user settings alone in both directions", () => {
    const plan = planShellSync(up, local);
    expect(plan.deletes).not.toContain("settings.local.json");
    expect(plan.writes).not.toContain("settings.local.json");
    expect(IGNORED_SHELL_PATHS.has("settings.local.json")).toBe(true);
  });

  it("keeps a locally owned path even if upstream starts publishing one there", () => {
    const collision = new Map([...up, ["scopes/aidlc-prd-implementation.md", "hash-upstream"]]);
    const plan = planShellSync(collision, local);
    expect(plan.writes).not.toContain("scopes/aidlc-prd-implementation.md");
    expect(plan.preserved).toEqual(["scopes/aidlc-prd-implementation.md"]);
    expect(LOCAL_ONLY_SHELL_PATHS.has("scopes/aidlc-prd-implementation.md")).toBe(true);
  });

  it("plans nothing when the trees already agree", () => {
    const plan = planShellSync(up, new Map(up));
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
    applyShellSync({ workspaceRoot: workspace, upstreamShellRoot: upstreamRoot, plan });
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
      upstreamBranch: "main",
      plan: {
        writes: ["tools/aidlc-version.ts"],
        overwrites: ["tools/aidlc-version.ts"],
        deletes: [],
        preserved: ["scopes/aidlc-prd-implementation.md"],
      },
    });
    expect(body).toContain("| AIDLC_VERSION | 2.6.124 | 2.7.0 |");
    expect(body).toContain("release:skip");
    expect(body).toContain("`tools/aidlc-version.ts`");
    expect(body).toContain("blob/main/CHANGELOG.md");
  });

  it("caps a long file list rather than pasting hundreds of paths", () => {
    const many = Array.from({ length: 25 }, (_, i) => `agents/agent-${i}.md`);
    const body = formatShellPrBody({
      version: "2.7.0",
      previousVersion: null,
      upstreamSha: SHA,
      upstreamBranch: "main",
      plan: { writes: many, overwrites: many, deletes: [], preserved: [] },
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
