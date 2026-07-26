import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dashboardSrc = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "packages/dashboard/src",
);

export default defineConfig({
  test: {
    // Two environments in one run: every package but the dashboard is Node
    // (filesystem, process, server), the dashboard is a browser package and
    // needs a DOM. Projects keep them apart without a second command.
    projects: [
      {
        test: {
          name: "node",
          include: ["packages/*/tests/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**", "packages/dashboard/**"],
        },
      },
      {
        esbuild: { jsx: "automatic" },
        resolve: {
          alias: {
            "@": dashboardSrc,
          },
        },
        test: {
          name: "dashboard",
          environment: "jsdom",
          include: ["packages/dashboard/tests/**/*.test.{ts,tsx}"],
          setupFiles: ["packages/dashboard/tests/setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["packages/*/src/**/*.ts", "packages/dashboard/src/**/*.tsx"],
      // Process-boundary code, verified by a smoke test rather than by unit
      // tests, so v8 in *this* process cannot see it:
      //  - btw spawn/cli: the manual OS smoke test (R-BTW-4).
      //  - dashboard-server server/cli: Bun.serve does not exist under the
      //    Node-hosted Vitest, so server-smoke.test.ts drives a spawned Bun
      //    child over real HTTP/WS instead (code-summary.md D-4).
      exclude: [
        "packages/btw/src/spawn.ts",
        "packages/btw/src/cli.ts",
        "packages/dashboard-server/src/server.ts",
        "packages/dashboard-server/src/cli.ts",
        "packages/dashboard-server/src/index.ts",
        //  - mcp-server index: a bin whose module body connects the stdio
        //    transport, so it cannot be imported here either. Covered by
        //    server-smoke.test.ts driving a spawned Bun child over real stdio.
        "packages/mcp-server/src/index.ts",
        //  - dashboard main.tsx: the browser entry point. It calls createRoot
        //    against a real document at module load, so importing it here would
        //    mount the app rather than test it; the bootstrap ordering it exists
        //    for is asserted in app-boot.test.tsx instead.
        "packages/dashboard/src/main.tsx",
      ],
      thresholds: {
        // team.md: the State Version parser is the risk centre of this project,
        // so it is gated on BRANCH coverage rather than lines (R-RC-2).
        "packages/reader-core/src/parse/**": {
          branches: 95,
          statements: 95,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
});
