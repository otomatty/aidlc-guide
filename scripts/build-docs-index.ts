#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { buildDocsIndex } from "../packages/official-docs/src/retrieval-build.ts";
import {
  DOCS_INDEX_REL,
  TRANSLATIONS_REL,
  type TranslationApprovals,
} from "../packages/official-docs/src/retrieval-types.ts";

export async function regenerateDocsIndex(root: string, check = false): Promise<void> {
  let approvals: TranslationApprovals = {};
  try {
    approvals = JSON.parse(await readFile(path.join(root, TRANSLATIONS_REL), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const index = await buildDocsIndex(root, approvals);
  const text = `${JSON.stringify(index)}\n`;
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
