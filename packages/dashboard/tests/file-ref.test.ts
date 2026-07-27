import { describe, expect, it } from "vitest";
import { parseFileRef } from "../src/viewer/file-ref.ts";

/**
 * The accept/reject table is the whole of this feature's logic, so it is the
 * whole of this test. Every string below was taken from the corpus of generated
 * artifacts under `aidlc/spaces/default/intents/` — the rejects are the things
 * that actually appear in code spans and are not files, not invented ones.
 */

const ACCEPTED: [span: string, path: string, line: number | null][] = [
  // Full repo-relative paths, the unambiguous case.
  ["packages/btw/src/plan.ts:20", "packages/btw/src/plan.ts", 20],
  ["packages/shared-types/src/index.ts", "packages/shared-types/src/index.ts", null],
  ["docs/guides/live-share.md:197", "docs/guides/live-share.md", 197],
  // Partial paths and bare basenames — resolved host-side on click.
  ["services/api.ts:105-119", "services/api.ts", 105],
  ["viewer/services/answer.ts", "viewer/services/answer.ts", null],
  ["AnswerEditor.tsx:168", "AnswerEditor.tsx", 168],
  ["cli.ts", "cli.ts", null],
  // A multi-range citation jumps to the first line named.
  ["MarkdownSurface.tsx:88-91,188-195", "MarkdownSurface.tsx", 88],
  // Config files at the repo root, and dotfiles.
  ["vitest.config.ts:16", "vitest.config.ts", 16],
  [".mcp.json", ".mcp.json", null],
  ["biome.json", "biome.json", null],
  // Artifacts citing other artifacts.
  ["aidlc-state.md", "aidlc-state.md", null],
  ["logical-components.md:12", "logical-components.md", 12],
  // Surrounding whitespace inside the span is incidental.
  ["  cli.ts:3  ", "cli.ts", 3],
  // A leading `./` is dropped, so the citation the corpus actually contains
  // resolves instead of rendering as a link that warns when clicked. The host
  // (`fileRefTarget`) drops the same prefix, so the two agree.
  ["./util/guard-path.ts", "util/guard-path.ts", null],
  ["./plan.ts:7", "plan.ts", 7],
  // Extensionless files, from the closed list. `.gitignore` is cited 19 times.
  [".gitignore:26-55", ".gitignore", 26],
  [".gitattributes", ".gitattributes", null],
  ["packages/btw/.gitignore", "packages/btw/.gitignore", null],
  // Recognised whole: `.lock` is not an extension a general rule could admit
  // without also admitting `Promise.all` and friends.
  ["bun.lock:22-28", "bun.lock", 22],
  ["bun.lockb", "bun.lockb", null],
  // Extensionless with a directory. Recognised by basename, not by the slash:
  // `packages/dashboard` has the same shape and is a directory.
  ["scripts/hooks/pre-push", "scripts/hooks/pre-push", null],
  ["pre-commit:12", "pre-commit", 12],
];

const REJECTED: [span: string, why: string][] = [
  ["", "empty"],
  ["bun run check", "a command, not a path"],
  ["vite build packages/dashboard", "a command containing a path"],
  ["GET /api/workflow", "an HTTP route"],
  ["packages/*", "a glob names a set"],
  ["packages/reader-core/src/parse/**", "a glob names a set"],
  ["*-questions.md", "a glob names a set"],
  ["node:path", "a module specifier — colon, but no extension"],
  ["127.0.0.1", "dotted, and `.1` is not an extension"],
  ["0.0.0.0", "dotted, and `.0` is not an extension"],
  ["reader-core", "a package name"],
  ["packages/dashboard", "a directory — nothing to focus a line in"],
  ["packages/dashboard/src/viewer/", "a directory"],
  ["guardPath", "an identifier"],
  ["--host", "a flag"],
  // The extensionless list is closed, so none of the dotted non-files the
  // corpus puts in code spans can sneak in behind `.gitignore`.
  [".then", "a property accessor"],
  [".parse", "a property accessor"],
  [".local", "a hostname fragment"],
  [".ts.net", "a domain"],
  [".jsonl", "an extension named as a suffix, not a file"],
  ["Dockerfile.dev", "not the exact allow-listed basename"],
  // The whole reason the set is closed: a corpus sweep found that nearly every
  // rejected `name.ext` code span is a property access, not a file.
  ["Promise.all", "a property access"],
  ["Bun.spawn", "a property access"],
  ["path.sep", "a property access"],
  ["React.lazy", "a property access"],
  ["marked.parse", "a property access"],
  ["MatrixCell.files", "a property access"],
  ["process.env", "a property access — its basename is not `.env`"],
  ["import.meta.env", "a property access — its basename is not `.env`"],
  ["example.com", "a hostname"],
  [":38", "a line-only continuation has no file to resolve"],
  ["/etc/passwd", "absolute"],
  ["/packages/btw/src/plan.ts", "absolute"],
  ["../../../etc/passwd.sh", "escapes the workspace"],
  ["packages/../../secrets.json", "escapes the workspace"],
  // Only the *leading* `./` is dropped; what is left still has to be clean.
  ["./../secrets.json", "escapes the workspace once the prefix is dropped"],
  ["packages/./plan.ts", "an interior `.` segment"],
  ["packages//plan.ts", "an empty segment"],
  ["plan.ts:0", "lines are 1-based"],
  ["plan.ts:999999999999999999999", "not a safe integer"],
  ["C:\\work\\plan.ts", "backslashes are not the artifact dialect"],
];

describe("parseFileRef — what counts as a file reference", () => {
  it.each(ACCEPTED)("accepts %j", (span, path, line) => {
    expect(parseFileRef(span)).toEqual({ path, line });
  });

  it.each(REJECTED)("rejects %j (%s)", (span) => {
    expect(parseFileRef(span)).toBeNull();
  });
});
