// Sensor entry point for focus-diagrams; the checks live in focus-diagram.ts.
//
// The native `aidlc` binary imports this file and calls main() with the fire flags
// (`--stage <slug> --output-path <file>`), so no bun is needed on the user's machine. Run as a
// script, it does the same. Either way it writes one JSON verdict to stdout.
import { runCli } from "./focus-diagram.ts";

export async function main(argv: string[]): Promise<void> {
  const code = await runCli(["sensor", ...argv], {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    cwd: process.cwd(),
  });
  if (code !== 0) process.exitCode = code;
}

if (import.meta.main) await main(process.argv.slice(2));
