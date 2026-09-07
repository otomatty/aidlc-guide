#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { bundledDocsRoot } from "./bundled-root.ts";
import { createDocsLibrary, serializeDocsReply } from "./retrieval.ts";
import type { Locale } from "./types.ts";

const HELP =
  'aidlc-docs search "質問" [--locale ja|en] [--limit 5] [--max-tokens 800] [--include-non-normative]\naidlc-docs read "節ID" [--max-tokens 1600] [--cursor 0] [--outline]\n共通: --root <docs/ を含む配布ルート>。結果の source を回答の根拠として表示してください。';

export async function runDocsCli(
  argv: string[],
  defaultRoot: string,
): Promise<{ status: number; text: string }> {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        root: { type: "string" },
        locale: { type: "string" },
        limit: { type: "string" },
        "max-tokens": { type: "string" },
        cursor: { type: "string" },
        outline: { type: "boolean" },
        "include-non-normative": { type: "boolean" },
        help: { type: "boolean" },
      },
    });
    if (values.help) return { status: 0, text: HELP };
    const [verb, argument] = positionals;
    if (positionals.length !== 2 || !argument || !["search", "read"].includes(verb ?? ""))
      return { status: 1, text: HELP };
    const library = createDocsLibrary(values.root ?? defaultRoot);
    const budget = values["max-tokens"] === undefined ? undefined : Number(values["max-tokens"]);
    const reply =
      verb === "search"
        ? await library.search({
            query: argument,
            locale: values.locale as Locale | undefined,
            limit: values.limit === undefined ? undefined : Number(values.limit),
            max_tokens: budget,
            include_non_normative: values["include-non-normative"],
          })
        : await library.read({
            id: argument,
            max_tokens: budget,
            cursor: values.cursor === undefined ? undefined : Number(values.cursor),
            mode: values.outline ? "outline" : "section",
          });
    return { status: "error" in reply ? 1 : 0, text: serializeDocsReply(reply) };
  } catch (error) {
    return { status: 1, text: error instanceof Error ? error.message : String(error) };
  }
}

if (import.meta.main) {
  const result = await runDocsCli(process.argv.slice(2), bundledDocsRoot(import.meta.url));
  process.stdout.write(`${result.text}\n`);
  process.exitCode = result.status;
}
