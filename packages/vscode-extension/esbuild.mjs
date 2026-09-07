import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

// Installed VSIXs have no sibling workspace packages or node_modules.
// Ship runnable MCP/CLI bundles beside extension.js.
await esbuild.build({
  entryPoints: {
    "aidlc-mcp": "../mcp-server/src/index.ts",
    "aidlc-docs": "../official-docs/src/cli.ts",
  },
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
});

const ctx = await esbuild.context({
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
  outfile: "dist/extension.js",
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
});

if (watch) {
  await ctx.watch();
  console.log("watching extension…");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
