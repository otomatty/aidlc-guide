import { fail } from "./errors.ts";

/** Parsed CLI options; mutual exclusion is validated here (business-rules.md). */
export type BtwCommand =
  | { mode: "side" }
  | { mode: "fork" }
  | { mode: "headless"; prompt: string }
  | { mode: "help" };

export const USAGE = 'usage: btw [--fork | -p "<question>" | --help]';

/**
 * argv (already sliced past the interpreter/script) -> BtwCommand.
 *
 * Hand-rolled: four options do not justify a dependency (tech-stack-decisions.md).
 * If this ever exceeds eight options, move to `util.parseArgs` — not a package.
 */
export function parse(argv: readonly string[]): BtwCommand {
  let fork = false;
  let help = false;
  let prompt: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    switch (arg) {
      case "-h":
      case "--help":
        help = true;
        break;
      case "--fork":
        fork = true;
        break;
      case "-p":
      case "--prompt": {
        const next = argv[i + 1];
        if (next === undefined) {
          throw fail({ reason: `${arg} requires a question. ${USAGE}` });
        }
        prompt = next;
        i++;
        break;
      }
      default:
        throw fail({ reason: `unknown option "${arg}". ${USAGE}` });
    }
  }

  // --help wins over everything: it must stay reachable even when the rest of
  // the invocation is nonsense.
  if (help) return { mode: "help" };

  if (fork && prompt !== undefined) {
    throw fail({ reason: `--fork and -p cannot be combined. ${USAGE}` });
  }
  if (prompt !== undefined) {
    if (prompt.trim() === "") {
      throw fail({ reason: `-p requires a non-empty question. ${USAGE}` });
    }
    return { mode: "headless", prompt };
  }
  if (fork) return { mode: "fork" };
  return { mode: "side" };
}
