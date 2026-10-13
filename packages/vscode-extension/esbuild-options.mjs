// The extension bundle's build options, shared by esbuild.mjs and the test
// that loads the built bundle (tests/bundle-load.test.ts).
export const extensionBuildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  // Pinned deliberately, not left to esbuild's default (`esnext`). The
  // extension host runs VS Code's bundled Node, so the floor is whatever
  // engines.vscode admits: ^1.100.0 ships Node 20 (Node 22 arrives in 1.122).
  // Without this, an esbuild upgrade silently raises the emitted syntax level
  // and the bundle can stop parsing on the oldest supported host -- a break no
  // test here would catch. Move this only together with engines.vscode.
  target: "node20",
  format: "cjs",
  // Prefer a package's ESM entry. On `platform: "node"` esbuild otherwise takes
  // `main`, and some packages point that at a UMD build (jsonc-parser does):
  // its wrapper hands `require` to the factory as a parameter, so esbuild
  // cannot follow `require("./impl/format")` and leaves it in the bundle. The
  // installed VSIX has no node_modules, so loading extension.js then throws
  // and activate() never runs -- no command is registered at all.
  mainFields: ["module", "main"],
  outfile: "dist/extension.js",
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
};
