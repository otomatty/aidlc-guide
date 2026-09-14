import type { Token, Tokens } from "marked";

export interface MarkdownEvidence {
  /** Inclusive, one-based lines in the original Markdown. */
  startLine: number;
  endLine: number;
  label?: string;
}

export interface EvidenceAttributes {
  "data-doc-evidence"?: "true";
  "aria-description"?: string;
  tabIndex?: -1;
}

export interface EvidenceMarkers {
  attributes(node: object): EvidenceAttributes;
}

const NO_ATTRIBUTES: EvidenceAttributes = {};

function newlines(text: string): number {
  let count = 0;
  for (const character of text) if (character === "\n") count++;
  return count;
}

/**
 * Marked strips list / quote prefixes before lexing their children. Preserve
 * their line numbers only when every child line matches its corresponding raw
 * line. Never search ahead for matching prose: repeated text is common in docs.
 */
function preservesLines(raw: string, text: string, kind: "item" | "quote"): boolean {
  const source = raw.split("\n");
  const content = text.split("\n");
  if (content.length > source.length) return false;
  for (let index = 0; index < content.length; index++) {
    const line = source[index]?.replace(/[\t ]+$/, "");
    const child = content[index]?.replace(/[\t ]+$/, "");
    if (line === undefined || child === undefined) return false;
    if (!line.endsWith(child)) return false;
    const prefix = line.slice(0, line.length - child.length);
    if (kind === "quote") {
      if (!/^(?: {0,3}>[\t ]?)?$/.test(prefix)) return false;
    } else if (index === 0) {
      if (!/^ {0,3}(?:[-+*]|\d+[.)])(?:[\t ]+(?:\[[ xX]\][\t ]*)?)?$/.test(prefix)) {
        return false;
      }
    } else if (!/^[\t ]*$/.test(prefix)) {
      return false;
    }
  }
  return source.slice(content.length).every((line) => line.trim() === "");
}

/** A simple item is highlighted on its li, avoiding nested duplicate marks. */
export function simpleListItem(item: Tokens.ListItem): boolean {
  const content = item.tokens.filter((token) => token.type !== "space");
  return content.length === 1 && content[0]?.type === "text";
}

/**
 * Source positions come from sequential raw token lengths. A lexer extension
 * that rewrites raw text stops position mapping at that point, rather than
 * risking a highlight on unrelated content.
 */
export function evidenceMarkers(
  markdown: string,
  tokens: readonly Token[],
  evidence: MarkdownEvidence | undefined,
): EvidenceMarkers | undefined {
  if (
    evidence === undefined ||
    !Number.isSafeInteger(evidence.startLine) ||
    !Number.isSafeInteger(evidence.endLine) ||
    evidence.startLine < 1 ||
    evidence.endLine < evidence.startLine ||
    evidence.endLine > newlines(markdown) + 1
  ) {
    return undefined;
  }
  const { startLine: evidenceStart, endLine: evidenceEnd } = evidence;
  const selected = new WeakSet<object>();
  const attributes: EvidenceAttributes = {
    "data-doc-evidence": "true",
    "aria-description": evidence.label ?? "回答の参照箇所",
    tabIndex: -1,
  };

  function mark(node: object, raw: string, startLine: number): void {
    const content = raw.trimEnd();
    if (content.trim() === "") return;
    const endLine = startLine + newlines(content);
    if (startLine <= evidenceEnd && endLine >= evidenceStart) selected.add(node);
  }

  function walk(source: string, children: readonly Token[], firstLine: number): void {
    let offset = 0;
    let line = firstLine;
    for (const token of children) {
      if (!source.startsWith(token.raw, offset)) return;
      switch (token.type) {
        case "heading":
        case "paragraph":
        case "text":
        case "code":
        case "html":
          mark(token, token.raw, line);
          break;
        case "table": {
          const table = token as Tokens.Table;
          // GFM table rows each occupy one physical line. Do not attribute the
          // delimiter row to a visible header or body row.
          const rows = token.raw.trimEnd().split("\n");
          if (rows.length !== table.rows.length + 2 || rows[0] === undefined) break;
          mark(table.header, rows[0], line);
          table.rows.forEach((row, index) => {
            const raw = rows[index + 2];
            if (raw !== undefined) mark(row, raw, line + index + 2);
          });
          break;
        }
        case "list": {
          const list = token as Tokens.List;
          let itemOffset = 0;
          let itemLine = line;
          for (const item of list.items) {
            if (!list.raw.startsWith(item.raw, itemOffset)) break;
            if (simpleListItem(item)) {
              mark(item, item.raw, itemLine);
            } else if (preservesLines(item.raw, item.text, "item")) {
              walk(item.text, item.tokens, itemLine);
            }
            itemOffset += item.raw.length;
            itemLine += newlines(item.raw);
          }
          break;
        }
        case "blockquote": {
          const quote = token as Tokens.Blockquote;
          if (preservesLines(quote.raw, quote.text, "quote")) {
            walk(quote.text, quote.tokens, line);
          }
          break;
        }
      }
      offset += token.raw.length;
      line += newlines(token.raw);
    }
  }

  walk(markdown, tokens, 1);
  return { attributes: (node) => (selected.has(node) ? attributes : NO_ATTRIBUTES) };
}
