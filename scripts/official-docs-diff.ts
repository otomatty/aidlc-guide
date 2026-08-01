/**
 * Should (US-08): compare upstream docs tree vs committed snapshot.
 * MVP stub — prints a placeholder report path; real diff lands when B5 is scheduled.
 *
 * Usage: bun scripts/official-docs-diff.ts [--upstream <path>]
 */
const upstream = process.argv.includes("--upstream")
  ? process.argv[process.argv.indexOf("--upstream") + 1]
  : "(not provided)";

console.log(`# Official docs diff report (stub)
upstream: ${upstream}
snapshot: docs/guide + docs/reference + docs/official-docs.manifest.json
status: stub — wire real tree diff in Bolt 5 / FR-U6
`);
