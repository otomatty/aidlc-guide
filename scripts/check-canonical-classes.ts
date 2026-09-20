#!/usr/bin/env bun
// Fail the quality gate when dashboard classes use a non-canonical Tailwind form
// that IntelliSense reports as `suggestCanonicalClasses` (error in the editor).

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_ROOT = "packages/dashboard/src";
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

/** Exact class tokens IntelliSense rewrites to a shorter canonical name. */
const CLASS_ALIASES: ReadonlyArray<{ found: string; expected: string }> = [
  { found: "break-words", expected: "wrap-break-word" },
  { found: "order-none", expected: "order-0" },
  { found: "max-w-[calc(100vw-2rem)]", expected: "max-w-viewport-gutter" },
  { found: "min-w-[96px]", expected: "min-w-24" },
  { found: "grid-cols-[1fr_auto]", expected: "grid-cols-title-actions" },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Boolean data variants: `data-[parked]:hidden` is `data-parked:hidden`.
 * Leave `data-[side=bottom]` and `data-[selected=true]` alone — those need a value.
 */
const BOOLEAN_DATA =
  /(?:^|[^A-Za-z0-9_-])((?:(?:group|peer|has|in|not)-)*data-\[[A-Za-z][\w-]*\]:)/g;

/** Descendant slot: `[&_[data-slot=tabs-trigger]]:` is `**:data-[slot=tabs-trigger]:`. */
const DESCENDANT_SLOT = /\[&_\[data-slot=([A-Za-z][\w-]*)\]\]:/g;

export type CanonicalIssue = {
  file: string;
  line: number;
  found: string;
  expected: string;
};

function lineNumber(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source.charCodeAt(i) === 10) line += 1;
  return line;
}

export function findCanonicalClassIssues(source: string, file = ""): CanonicalIssue[] {
  const issues: CanonicalIssue[] = [];
  for (const alias of CLASS_ALIASES) {
    const pattern = new RegExp(
      `(?<![A-Za-z0-9_-])${escapeRegExp(alias.found)}(?![A-Za-z0-9_-])`,
      "g",
    );
    for (const match of source.matchAll(pattern)) {
      if (match.index === undefined) continue;
      issues.push({
        file,
        line: lineNumber(source, match.index),
        found: alias.found,
        expected: alias.expected,
      });
    }
  }
  BOOLEAN_DATA.lastIndex = 0;
  for (const match of source.matchAll(BOOLEAN_DATA)) {
    const found = match[1];
    if (found === undefined || match.index === undefined) continue;
    const expected = found.replace(/-\[([A-Za-z][\w-]*)\]:/, "-$1:");
    issues.push({
      file,
      line: lineNumber(source, match.index + match[0].indexOf(found)),
      found,
      expected,
    });
  }
  DESCENDANT_SLOT.lastIndex = 0;
  for (const match of source.matchAll(DESCENDANT_SLOT)) {
    const slot = match[1];
    if (slot === undefined || match.index === undefined) continue;
    issues.push({
      file,
      line: lineNumber(source, match.index),
      found: match[0],
      expected: `**:data-[slot=${slot}]:`,
    });
  }
  return issues;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(next));
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(next);
  }
  return out;
}

export function scanDashboard(root: string): CanonicalIssue[] {
  const base = path.join(root, SOURCE_ROOT);
  return walk(base).flatMap((file) =>
    findCanonicalClassIssues(
      readFileSync(file, "utf8"),
      path.relative(root, file).replaceAll("\\", "/"),
    ),
  );
}

if (import.meta.main) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const issues = scanDashboard(root);
  if (issues.length === 0) process.exit(0);
  console.error("canonical Tailwind classes: use the form IntelliSense suggests.");
  console.error("");
  for (const issue of issues) {
    console.error(`  ${issue.file}:${issue.line}: ${issue.found} → ${issue.expected}`);
  }
  console.error("");
  process.exit(1);
}
