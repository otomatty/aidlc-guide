import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without globals, so RTL's own auto-cleanup never registers.
afterEach(cleanup);

/**
 * RTL's 1000ms default is a wall clock, and the full `bun run check` runs two
 * projects under coverage instrumentation. Assertions that wait on a real
 * dynamic `import()` (the artifact viewer's lazy chunk) then a fetch then a
 * render overran it about one run in four — a gate that is red 25% of the time
 * for load reasons teaches the team to re-run rather than to read it, and this
 * command is the project's only gate (team.md). The budget is generous because
 * a wait that ends early is a flake and a wait that ends late costs nothing:
 * the tests still fail immediately on a real assertion failure.
 */
configure({ asyncUtilTimeout: 5000 });
