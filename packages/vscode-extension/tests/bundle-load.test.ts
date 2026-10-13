import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { extensionBuildOptions } from "../esbuild-options.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load the bundle the way the extension host does: plain Node `require`, with
// only `vscode` supplied from outside. Anything the bundle still requires at
// run time must resolve beside it, and an installed VSIX has no node_modules.
const LOAD_BUNDLE = `
const Module = require("node:module");
const load = Module._load;
const vscode = new Proxy(function () {}, {
  get: (_target, key) => (key === "__esModule" ? false : vscode),
  apply: () => vscode,
  construct: () => vscode,
});
Module._load = function (request, ...rest) {
  return request === "vscode" ? vscode : load.call(this, request, ...rest);
};
const extension = require(process.argv[1]);
process.stdout.write(JSON.stringify(Object.keys(extension).sort()));
`;

describe("built extension bundle", () => {
  let outDir: string;
  let outfile: string;

  beforeAll(async () => {
    outDir = mkdtempSync(path.join(tmpdir(), "aidlc-extension-bundle-"));
    outfile = path.join(outDir, "extension.js");
    await esbuild.build({
      ...extensionBuildOptions,
      absWorkingDir: packageRoot,
      outfile,
      sourcemap: false,
      logLevel: "silent",
    });
  }, 60_000);

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it("loads outside the workspace and exports activate/deactivate", () => {
    const run = spawnSync("node", ["-e", LOAD_BUNDLE, outfile], {
      cwd: outDir,
      encoding: "utf8",
    });
    expect(run.error).toBeUndefined();
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual(["activate", "deactivate"]);
  });

  it("leaves no relative require for Node to resolve at run time", () => {
    const bundle = readFileSync(outfile, "utf8");
    expect(bundle.match(/\brequire\d*\(\s*["']\.\.?\/[^"']*["']\)/g) ?? []).toEqual([]);
  });
});
