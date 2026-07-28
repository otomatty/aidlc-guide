/**
 * Parser for `.claude/agents/*.md` persona files (YAML frontmatter with
 * `display_name` / `description`, then the markdown body). Lives here because
 * docs-bridge owns agent metadata resolution (BR-DB-1 — `agentEntry` /
 * `stagesForAgent` are the other half); handlers read files and call this.
 * Pure string parsing — no filesystem.
 */
export function parsePersonaMarkdown(text: string): {
  displayName: string;
  description: string;
  markdown: string;
} {
  if (!text.startsWith("---")) {
    return { displayName: "", description: "", markdown: text.trim() };
  }
  const end = text.indexOf("\n---", 3);
  if (end < 0) {
    return { displayName: "", description: "", markdown: text.trim() };
  }

  const frontmatter = text.slice(3, end).trim();
  const body = text
    .slice(end + 4)
    .replace(/^\n/, "")
    .trim();
  let displayName = "";
  let description = "";
  const lines = frontmatter.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const displayMatch = /^display_name:\s*(.+)$/.exec(line);
    if (displayMatch?.[1] !== undefined) {
      displayName = displayMatch[1].trim();
      continue;
    }

    const descMatch = /^description:\s*(.*)$/.exec(line);
    if (descMatch === null) continue;

    let value = descMatch[1]?.trim() ?? "";
    if (value === ">" || value.startsWith(">")) {
      const parts: string[] = [];
      if (value.startsWith(">")) {
        const first = value.slice(1).trim();
        if (first !== "") parts.push(first);
      }
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1] ?? "")) {
        i++;
        parts.push((lines[i] ?? "").trim());
      }
      value = parts.join(" ");
    }
    description = value;
  }

  return { displayName, description, markdown: body };
}
