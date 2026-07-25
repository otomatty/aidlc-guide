#!/usr/bin/env bun
import {
  buildExposureNotice,
  EXPOSURE_ADDRESS_HEADING,
  EXPOSURE_NO_ADDRESS_HINT,
} from "./exposure-notice.ts";
import { DEFAULT_PORT, DIST_MISSING_HINT, serve } from "./server.ts";

const HELP = `aidlc-dashboard — local AI-DLC workflow dashboard

Usage: aidlc-dashboard [--port <n>] [--host]

  --port <n>  Port to listen on (default ${DEFAULT_PORT}; 0 picks a free port).
  --host      Bind 0.0.0.0 so others on your LAN can view it.
              Read-only: answer writing is disabled for every client.
  --help      Show this message.
`;

export interface CliOptions {
  port: number;
  host: boolean;
  help: boolean;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = { port: DEFAULT_PORT, host: false, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--host") {
      options.host = true;
    } else if (arg === "--port") {
      const raw = argv[i + 1];
      const port = Number(raw);
      if (raw === undefined || !Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(`--port expects an integer 0-65535, got ${raw ?? "nothing"}`);
      }
      options.port = port;
      i += 1;
    } else {
      throw new Error(`unknown argument: ${arg ?? ""}`);
    }
  }
  return options;
}

async function main(argv: readonly string[]): Promise<number> {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const server = await serve({ port: options.port, host: options.host });

  // Enumerated once, here, and never again (P-MM-1).
  const notice = buildExposureNotice(server.port, options.host);

  // The warning goes out before the URL: an operator who is about to paste the
  // address into a group chat should read what they are exposing first.
  // Loopback needs no list — the ready line below already *is* the only URL.
  if (options.host) {
    process.stdout.write(`${notice.warning}\n`);
    // R-MM-2: an empty list (enumeration failed, or an IPv6-only LAN) must not
    // leave a heading promising URLs that never come.
    if (notice.addresses.length === 0) {
      process.stdout.write(`${EXPOSURE_NO_ADDRESS_HINT}\n`);
    } else {
      process.stdout.write(`${EXPOSURE_ADDRESS_HEADING}\n`);
      for (const address of notice.addresses) process.stdout.write(`  ${address}\n`);
    }
  }
  if (server.apiOnly) process.stdout.write(`${DIST_MISSING_HINT}\n`);
  process.stdout.write(`AIDLC Guide dashboard: http://${server.hostname}:${server.port}\n`);
  return 0;
}

// A bind failure must be fatal. Retrying on another port, or quietly dropping
// back to loopback after `--host`, would leave the operator with a URL that is
// not the one they were told about (BR-DS-2).
try {
  const code = await main(process.argv.slice(2));
  if (code !== 0) process.exit(code);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`aidlc-dashboard: ${message}\n`);
  // Bun does not surface the errno here — it throws "Failed to start server.
  // Is port <n> in use?" — so matching only EADDRINUSE silently swallowed the
  // one piece of advice this branch exists to give (found by the R-MM-1 test).
  if (/EADDRINUSE|address already in use|port \d+ in use/i.test(message)) {
    process.stderr.write(
      "aidlc-dashboard: そのポートは使用中です。--port で別のポートを指定してください。\n",
    );
  }
  process.exit(1);
}
