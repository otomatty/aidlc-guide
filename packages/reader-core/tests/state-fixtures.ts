/** A minimal supported state file whose Stage Progress lists `slugs` in graph order. */
export function stateWithStages(slugs: readonly string[], extra = ""): string {
  return [
    "## Project Information",
    "- **Project**: example",
    "- **Scope**: classic",
    "- **State Version**: 8",
    "",
    "## Scope Configuration",
    "- **Depth**: Standard",
    extra,
    "",
    "## Stage Progress",
    "### CONSTRUCTION PHASE",
    ...slugs.map((slug) => `- [ ] ${slug} — EXECUTE`),
    "",
  ].join("\n");
}
