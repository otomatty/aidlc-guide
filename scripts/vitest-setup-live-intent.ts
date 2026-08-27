import path from "node:path";
import { fileURLToPath } from "node:url";
import { pinLiveIntent } from "./live-intent.ts";

/**
 * Node-project setup: elect a live record before any test file is imported,
 * so the suites that read this repository's own workspace behave the same on a
 * fresh clone as they do in a developer's session. See `live-intent.ts` for
 * why this belongs to the gate rather than to the CI workflow.
 *
 * It runs inside the worker, ahead of module evaluation, which is what the
 * two consumers need: `api-core/tests/timings.test.ts` reads the variable at
 * module scope, and `mcp-server/tests/server-smoke.test.ts` forwards
 * `process.env` to the Bun child it spawns.
 */
await pinLiveIntent(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
