import * as esbuild from "esbuild";
import { extensionBuildOptions } from "./esbuild-options.mjs";

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

const ctx = await esbuild.context(extensionBuildOptions);

if (watch) {
  await ctx.watch();
  console.log("watching extension…");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
