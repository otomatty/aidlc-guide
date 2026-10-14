import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  doctorScopeGaps,
  duplicatePushRuns,
  permissionEscalations,
  type Workflow,
} from "./ci-workflow-policy";

describe("reusable workflow permissions", () => {
  const called: Workflow = {
    on: { workflow_call: {} },
    permissions: { contents: "read" },
    jobs: {
      capture: { "runs-on": "ubuntu-latest" },
      record: { "runs-on": "ubuntu-latest", permissions: { contents: "write" } },
    },
  };

  it("reports a nested job that asks for more than its caller grants", () => {
    // The 2026-10-10 startup_failure: the caller held contents: read and the
    // called workflow carried a contents: write job, even one never run.
    const caller: Workflow = {
      permissions: { contents: "read" },
      jobs: { capture: { uses: "./.github/workflows/called.yml" } },
    };
    const found = permissionEscalations(
      new Map([
        ["caller.yml", caller],
        ["called.yml", called],
      ]),
    );
    expect(found).toEqual([
      "caller.yml: job capture calls called.yml, whose job record requests contents: write but the caller grants contents: read",
    ]);
  });

  it("accepts a caller job that grants what the called jobs request", () => {
    const caller: Workflow = {
      permissions: { contents: "read" },
      jobs: {
        capture: { uses: "./.github/workflows/called.yml", permissions: { contents: "write" } },
      },
    };
    expect(
      permissionEscalations(
        new Map([
          ["caller.yml", caller],
          ["called.yml", called],
        ]),
      ),
    ).toEqual([]);
  });

  it("treats a missing scope as none and expands read-all / write-all", () => {
    const readOnly: Workflow = {
      jobs: { job: { "runs-on": "ubuntu-latest", permissions: { "pull-requests": "read" } } },
    };
    const callers = (permissions: unknown): Workflow => ({
      permissions,
      jobs: { call: { uses: "./.github/workflows/read-only.yml" } },
    });
    const run = (permissions: unknown) =>
      permissionEscalations(
        new Map([
          ["caller.yml", callers(permissions)],
          ["read-only.yml", readOnly],
        ]),
      );
    expect(run({ contents: "read" })).toHaveLength(1);
    expect(run("read-all")).toEqual([]);
    expect(run("write-all")).toEqual([]);
  });

  it("compares the level of unnamed scopes when either side uses read-all / write-all", () => {
    const writeAll: Workflow = { permissions: "write-all", jobs: { job: {} } };
    const run = (permissions: unknown) =>
      permissionEscalations(
        new Map([
          ["caller.yml", { permissions, jobs: { call: { uses: "./.github/workflows/w.yml" } } }],
          ["w.yml", writeAll],
        ]),
      );
    expect(run("read-all")).toEqual([
      "caller.yml: job call calls w.yml, whose job job requests every other scope: write but the caller grants every other scope: read",
    ]);
    expect(run({ contents: "write" })).toHaveLength(1);
    expect(run("write-all")).toEqual([]);
  });

  it("skips callers whose token scope is the repository default", () => {
    const caller: Workflow = { jobs: { call: { uses: "./.github/workflows/called.yml" } } };
    expect(
      permissionEscalations(
        new Map([
          ["caller.yml", caller],
          ["called.yml", called],
        ]),
      ),
    ).toEqual([]);
  });
});

describe("required checks re-run on main", () => {
  const required = ["check (ubuntu-latest)", "check (windows-latest)", "release-labels"];
  const check = (on: unknown): Workflow => ({
    on,
    jobs: { check: { strategy: { matrix: { os: ["ubuntu-latest", "windows-latest"] } } } },
  });

  it("reports a required-check workflow that also runs on push to main", () => {
    expect(
      duplicatePushRuns(
        new Map([["check.yml", check({ pull_request: {}, push: { branches: ["main"] } })]]),
        required,
        true,
      ),
    ).toEqual([
      "check.yml: produces required checks but also runs on push to main; with up-to-date branches required, that push re-tests the tree its pull request already passed",
    ]);
  });

  it("reports an unfiltered push trigger, which includes main", () => {
    expect(
      duplicatePushRuns(new Map([["check.yml", check(["push", "pull_request"])]]), required, true),
    ).toHaveLength(1);
  });

  it("matches branch filters as GitHub glob patterns against main", () => {
    const reaches = (push: unknown) =>
      duplicatePushRuns(new Map([["check.yml", check({ push })]]), required, true).length === 1;
    expect(reaches({ "branches-ignore": ["release/**"] })).toBe(true);
    expect(reaches({ "branches-ignore": ["dev", "ma*"] })).toBe(false);
    expect(reaches({ branches: ["m*"] })).toBe(true);
    expect(reaches({ branches: ["ma?in"] })).toBe(true);
    expect(reaches({ branches: ["[lm]ain"] })).toBe(true);
    expect(reaches({ branches: ["**"] })).toBe(true);
    expect(reaches({ branches: ["feature/*", "*/main"] })).toBe(false);
    // Later patterns win: a trailing negation removes main again.
    expect(reaches({ branches: ["*", "!main"] })).toBe(false);
    expect(reaches({ branches: ["!main", "main"] })).toBe(true);
    // Only tag filters: GitHub then runs on tag pushes, never on branches.
    expect(reaches({ tags: ["v*"] })).toBe(false);
  });

  it("allows push triggers that cannot reach main, or no strict policy", () => {
    const branches = check({ pull_request: {}, push: { branches: ["release/*"] } });
    const main = check({ pull_request: {}, push: { branches: ["main"] } });
    expect(duplicatePushRuns(new Map([["check.yml", branches]]), required, true)).toEqual([]);
    expect(duplicatePushRuns(new Map([["check.yml", main]]), required, false)).toEqual([]);
  });

  it("ignores push workflows that produce no required check", () => {
    const release: Workflow = { on: { push: { branches: ["main"] } }, jobs: { publish: {} } };
    expect(duplicatePushRuns(new Map([["release.yml", release]]), required, true)).toEqual([]);
  });
});

describe("doctor-contract change scope", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function repo() {
    const root = mkdtempSync(path.join(tmpdir(), "doctor-scope-"));
    roots.push(root);
    const write = (file: string, body: string) => {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), body);
    };
    write("scripts/capture.ts", 'import { b } from "./helper.ts";\nimport x from "@acme/x";\n');
    write("scripts/helper.ts", 'export const b = await import("../data/table.json");\n');
    write("data/table.json", "{}\n");
    write("packages/x/package.json", JSON.stringify({ name: "@acme/x", exports: "./src/main.ts" }));
    write("packages/x/src/main.ts", 'export { default } from "./inner";\n');
    write("packages/x/src/inner.ts", "export default 1;\n");
    return root;
  }

  const workflow = (inputs: string[]): Workflow => ({
    jobs: {
      scope: { steps: [{ id: "decide", env: { DOCTOR_INPUTS: `${inputs.join("\n")}\n` } }] },
      "doctor-contract": {
        steps: [
          { run: "bun install" },
          { run: "bun scripts/package.ts claude", "working-directory": "logs/upstream" },
          { run: "bun scripts/capture.ts --out logs/x" },
        ],
      },
    },
  });

  it("lists every imported file and declared data input the scope misses", () => {
    expect(doctorScopeGaps(repo(), workflow(["scripts/capture.ts"]), ["fixtures/"])).toEqual([
      "data/table.json",
      "fixtures/",
      "packages/x/src/inner.ts",
      "packages/x/src/main.ts",
      "scripts/helper.ts",
    ]);
  });

  it("accepts directory prefixes and exact files that cover the closure", () => {
    expect(
      doctorScopeGaps(
        repo(),
        workflow(["scripts/", "data/table.json", "packages/x/", "fixtures/"]),
        ["fixtures/"],
      ),
    ).toEqual([]);
  });

  it("does not let a bare prefix stand in for a directory", () => {
    // `data/table` is not `data/table.json`: entries are exact files unless
    // they end in a slash, matching the workflow's own comparison.
    expect(
      doctorScopeGaps(repo(), workflow(["scripts/", "data/table", "packages/x/"]), []),
    ).toEqual(["data/table.json"]);
  });

  it("refuses a workflow without the scope list rather than passing silently", () => {
    expect(() =>
      doctorScopeGaps(repo(), { jobs: { "doctor-contract": { steps: [] } } }, []),
    ).toThrow("DOCTOR_INPUTS");
  });
});
