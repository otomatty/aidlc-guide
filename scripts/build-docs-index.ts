#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { serializeDocsIndex } from "../packages/official-docs/src/index-file.ts";
import { buildDocsIndex } from "../packages/official-docs/src/retrieval-build.ts";
import {
  DOCS_INDEX_REL,
  TRANSLATIONS_REL,
  type TranslationApprovals,
} from "../packages/official-docs/src/retrieval-types.ts";

/** Validate reviewer-authored approvals before interpreting their translation status. */
export function parseTranslationApprovals(raw: unknown): TranslationApprovals {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(`${TRANSLATIONS_REL}: document-path object required`);
  const result: TranslationApprovals = {};
  for (const [docPath, entry] of Object.entries(raw)) {
    if (
      entry === null ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      ![entry.enHash, entry.jaHash].every(
        (hash) => typeof hash === "string" && /^[0-9a-f]{64}$/i.test(hash),
      )
    )
      throw new Error(
        `${TRANSLATIONS_REL}: ${docPath}: enHash and jaHash must be 64 hexadecimal characters`,
      );
    Object.defineProperty(result, docPath, {
      value: { enHash: entry.enHash.toLowerCase(), jaHash: entry.jaHash.toLowerCase() },
      enumerable: true,
    });
  }
  return result;
}

/** Generate the canonical index, or fail without writing when check detects drift. */
export async function regenerateDocsIndex(root: string, check = false): Promise<void> {
  let approvals: TranslationApprovals = {};
  try {
    approvals = parseTranslationApprovals(
      JSON.parse(await readFile(path.join(root, TRANSLATIONS_REL), "utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const index = await buildDocsIndex(root, approvals);
  const text = serializeDocsIndex(index);
  const target = path.join(root, DOCS_INDEX_REL);
  if (check) {
    if ((await readFile(target, "utf8").catch(() => "")) !== text)
      throw new Error("文書索引が古くなっています。bun run build:docs-index を実行してください。");
  } else {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text, "utf8");
  }
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({
      options: { workspace: { type: "string" }, check: { type: "boolean" } },
    });
    const root = path.resolve(
      values.workspace ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
    );
    await regenerateDocsIndex(root, values.check);
    console.log(values.check ? "文書索引に差分はありません。" : "文書索引を生成しました。");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
