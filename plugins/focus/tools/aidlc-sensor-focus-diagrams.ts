// Sensor entry point for focus-diagrams. The engine runs
// `bun aidlc-sensor-focus-diagrams.ts --stage <slug> --output-path <file>` and
// reads one JSON verdict from stdout; the checks live in focus-diagram.ts.
import { runCli } from "./focus-diagram.ts";

const code = await runCli(["sensor", ...process.argv.slice(2)], {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  cwd: process.cwd(),
});
process.exit(code);
