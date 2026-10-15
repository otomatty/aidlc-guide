// focus-diagram: checks the diagrams of focus-flow artifacts before a person approves them.
//
// Agents draw diagrams freely: an SVG file beside the document, embedded as an image, or a
// Mermaid block. Nothing is rendered from source data, so the check does not judge how a
// diagram looks. It checks that the artifacts a person approves have one, that every image
// stays inside the document's folder, and that an SVG loads nothing from outside and runs no
// code when it is opened directly (GitHub, an editor, a browser).
//
// The engine runs the sensor through aidlc-sensor-focus-diagrams.ts: the native `aidlc`
// binary imports it and calls main(argv), so this file needs no bun on the user's machine.
// This file is copied into <harness>/tools/ and must stay dependency-free.

import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

export type ImageRef = {
  alt: string;
  path: string;
  uncertain: boolean;
  base?: true;
  unknownReference?: true;
};
export type Violation = { code: string; message: string; target?: string };
export type CheckReport = { pass: boolean; diagrams: number; violations: Violation[] };

/**
 * Expand the tabs in each line's indentation and container markers to tab stops of four columns,
 * as CommonMark reads them there, so the block structure can be measured in spaces.
 */
function expandIndentTabs(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      const lead = /^(?:[ \t]*(?:>|(?:[-*+]|\d{1,9}[.)])(?=[ \t]|$)))*[ \t]*/.exec(line)?.[0] ?? "";
      if (!lead.includes("\t")) return line;
      let expanded = "";
      for (const char of lead)
        expanded += char === "\t" ? " ".repeat(4 - (expanded.length % 4)) : char;
      return expanded + line.slice(lead.length);
    })
    .join("\n");
}

/**
 * Hide fenced code blocks, including those inside blockquotes and list items. Each line of one
 * becomes a rule (`***`) inside the same containers: like the code, it shows nothing, ends a
 * paragraph and keeps its blockquote or list item open. A fence that is never closed runs to the
 * end of its container: the document, the quote or the list item.
 */
function withoutFencedCode(markdown: string): string {
  const lines = markdown.split("\n");
  const blocks = blockLines(lines);
  return lines
    .map((line, number) => {
      const block = blocks[number];
      if (!block?.code || !block.body.trim()) return line;
      return `${line.slice(0, line.length - block.body.length)}***`;
    })
    .join("\n");
}

/** One line as the block structure sees it. */
interface BlockLine {
  /** The line without the blockquote markers, list markers and indentation of its containers. */
  body: string;
  /** Whether it continues a paragraph, which a definition or a type-7 HTML block cannot start. */
  continues: boolean;
  /** Whether it continues a paragraph only lazily, outside the containers that paragraph is in. */
  lazy: boolean;
  /** Whether it belongs to fenced code, opening and closing fences included. */
  code: boolean;
  /** Whether it is inside a raw HTML block, where Markdown is shown as text. */
  html: boolean;
  /** Whether it is raw text, as in <script>, where even a tag is not shown. */
  rawText: boolean;
}

const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

/**
 * Where a raw HTML block starts on a line, and how it ends: <pre>, <script>, <style> and
 * <textarea> at their closing tag; a processing instruction, declaration or CDATA section at its
 * closing mark; a block-level tag, or any other tag that stands complete and alone on its line
 * outside a paragraph, at the next blank line.
 */
function htmlBlockStart(
  body: string,
  continues: boolean,
): { end: RegExp | "blank"; raw: boolean; ends: boolean } | undefined {
  // A comment, processing instruction, declaration or CDATA block is passed through as it is;
  // what a browser then shows of it depends on where its first `>` falls, so none of it counts.
  // Declarations and CDATA match in any case, as the dashboard's renderer matches them.
  const special = /^ {0,3}<(\?|!--|!\[CDATA\[|![a-z])/i.exec(body);
  if (special) {
    const opener = special[1] ?? "";
    const end =
      opener === "?" ? /\?>/ : opener === "!--" ? /-->/ : opener.startsWith("![") ? /\]\]>/ : />/;
    return { end, raw: true, ends: end.test(body.slice(special[0].length)) };
  }
  const start = /^ {0,3}<(\/?)([a-z][a-z0-9-]*)(?=[\s/>]|$)/i.exec(body);
  if (!start) return undefined;
  const name = (start[2] ?? "").toLowerCase();
  const literal = !start[1] && /^(?:pre|script|style|textarea)$/.test(name);
  if (
    !literal &&
    !HTML_BLOCK_TAGS.has(name) &&
    (continues ||
      !/^ {0,3}(?:<[a-z][a-z0-9-]*(?:[^>"']|"[^"]*"|'[^']*')*>|<\/[a-z][a-z0-9-]*[ \t]*>)[ \t]*$/i.test(
        body,
      ))
  )
    return undefined;
  const end = literal ? new RegExp(`</${name}>`, "i") : "blank";
  return { end, raw: literal && name !== "pre", ends: end instanceof RegExp && end.test(body) };
}

/**
 * Read the block structure the way CommonMark does, line by line. A blockquote needs its `>` on
 * every line; a list item, the indentation of its content (a blank line keeps it open). A line
 * that matches neither but would continue a paragraph is a lazy continuation and keeps them open;
 * any other line closes them. A rule wins over a list item; only a non-empty bullet or an item
 * numbered 1 interrupts a paragraph. Fenced code and an HTML block take every line their
 * containers keep, until their end. Over-reading HTML blocks only stops images being counted;
 * they are still checked.
 */
function blockLines(lines: string[]): BlockLine[] {
  // Open containers, outermost first: a blockquote, or a list item whose content starts that
  // many columns in.
  let open: Array<"quote" | number> = [];
  // The open leaf block: a paragraph, fenced code and the fence that closes it, or a raw HTML
  // block and how it ends.
  let leaf: "paragraph" | { fence: RegExp } | { end: RegExp | "blank"; raw: boolean } | undefined;
  return lines.map((line) => {
    let rest = line;
    const block = (fields: Partial<BlockLine> = {}): BlockLine => ({
      body: rest,
      continues: false,
      lazy: false,
      code: false,
      html: false,
      rawText: false,
      ...fields,
    });
    let matched = 0;
    for (const container of open) {
      if (container === "quote") {
        const marker = /^ {0,3}>[ \t]?/.exec(rest)?.[0];
        if (marker === undefined) break;
        rest = rest.slice(marker.length);
      } else {
        const indent = /^ */.exec(rest)?.[0].length ?? 0;
        if (rest.trim() && indent < container) break;
        rest = rest.slice(Math.min(indent, container));
      }
      matched++;
    }
    const all = matched === open.length;
    if (all && leaf && leaf !== "paragraph") {
      if ("fence" in leaf) {
        if (leaf.fence.test(rest)) leaf = undefined;
        return block({ code: true });
      }
      const { end, raw } = leaf;
      if (end === "blank" && !rest.trim()) {
        leaf = undefined;
        return block();
      }
      if (end instanceof RegExp && end.test(rest)) leaf = undefined;
      return block({ html: true, rawText: raw });
    }
    const paragraph = leaf === "paragraph";
    const opened: Array<"quote" | number> = [];
    for (;;) {
      const quote = /^ {0,3}>[ \t]?/.exec(rest)?.[0];
      if (quote !== undefined) {
        opened.push("quote");
        rest = rest.slice(quote.length);
        continue;
      }
      const item = /^( {0,3}(?:[-*+]|(\d{1,9})[.)]))([ \t]*)/.exec(rest);
      if (!item || THEMATIC_BREAK.test(rest)) break;
      const marker = (item[1] ?? "").length;
      const space = (item[3] ?? "").length;
      const content = rest.slice(item[0].length);
      if (!space && content) break;
      if (
        paragraph &&
        all &&
        !opened.length &&
        (!content || (item[2] !== undefined && Number(item[2]) !== 1))
      )
        break;
      // Five or more spaces after a marker leave the content as indented code, which starts one
      // space after the marker, as does the content of an item that starts with a blank line.
      if (space >= 5 || !content) {
        opened.push(marker + 1);
        rest = rest.slice(marker + 1);
        break;
      }
      opened.push(marker + space);
      rest = content;
    }
    // A backtick fence's info string cannot contain a backtick (that line is inline code).
    const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(rest);
    const run =
      fence && !(fence[1]?.startsWith("`") && fence[2]?.includes("`")) ? (fence[1] ?? "") : "";
    const lazy =
      paragraph &&
      !all &&
      !opened.length &&
      rest.trim() !== "" &&
      !run &&
      !THEMATIC_BREAK.test(rest) &&
      !/^ {0,3}#{1,6}(?:[ \t]|$)/.test(rest) &&
      !htmlBlockStart(rest, true);
    const continues = lazy || (paragraph && all && !opened.length);
    if (!lazy && (opened.length || !all)) {
      open = [...open.slice(0, matched), ...opened];
      leaf = undefined;
    }
    if (!rest.trim()) {
      leaf = undefined;
      return block();
    }
    if (run) {
      leaf = { fence: new RegExp(`^ {0,3}${run[0]}{${run.length},}[ \\t]*$`) };
      return block({ code: true });
    }
    const html = htmlBlockStart(rest, continues);
    if (html) {
      leaf = html.ends ? undefined : html;
      return block({ continues, lazy, html: true, rawText: html.raw });
    }
    const ends =
      /^ {0,3}#{1,6}(?:[ \t]|$)/.test(rest) ||
      THEMATIC_BREAK.test(rest) ||
      (continues ? !lazy && /^ {0,3}(?:=+|-+)[ \t]*$/.test(rest) : /^(?: {4}| {0,3}\t)/.test(rest));
    leaf = ends ? undefined : "paragraph";
    return block({ continues, lazy });
  });
}

/** Named references the check decodes. Names are exact, as in HTML: `&Tab;` is a tab, `&tab;` none. */
const NAMED_REFERENCES = new Map([
  ["amp", "&"],
  ["AMP", "&"],
  ["lt", "<"],
  ["LT", "<"],
  ["gt", ">"],
  ["GT", ">"],
  ["quot", '"'],
  ["QUOT", '"'],
  ["apos", "'"],
  ["colon", ":"],
  ["sol", "/"],
  ["period", "."],
  ["Tab", "\t"],
  ["NewLine", "\n"],
]);

/**
 * Whether every renderer reads a numeric reference to `code` as that character. NUL, most control
 * characters, surrogates, noncharacters and values past U+10FFFF are replaced (with U+FFFD, or by
 * Windows-1252 for 0x80–0x9F) in ways that differ between them.
 */
function plainCodePoint(code: number): boolean {
  return !(
    code > 0x10ffff ||
    (code >= 0xd800 && code <= 0xdfff) ||
    (code >= 0xfdd0 && code <= 0xfdef) ||
    (code & 0xfffe) === 0xfffe ||
    code <= 0x08 ||
    code === 0x0b ||
    (code >= 0x0e && code <= 0x1f) ||
    (code >= 0x7f && code <= 0x9f)
  );
}

/**
 * Decode character references the way a browser does before it loads an address, so an encoded
 * address (`https&#58;//`) is checked as what it becomes. A numeric reference to a character
 * renderers do not keep becomes U+FFFD, which names no file. Unknown named references stay as
 * written, and the check rejects an address that still holds one.
 */
function decodeReferences(text: string): string {
  return text.replace(
    // Every digit is read, as a browser reads them: `&#00000000058;` is `:`.
    /&(?:#(\d+);?|#x([0-9a-f]+);?|([a-z]+);)/gi,
    (whole, decimal?: string, hex?: string, name?: string) => {
      if (decimal || hex) {
        const code = decimal ? Number(decimal) : Number.parseInt(hex ?? "", 16);
        return plainCodePoint(code) ? String.fromCodePoint(code) : "\u{FFFD}";
      }
      return NAMED_REFERENCES.get(name ?? "") ?? whole;
    },
  );
}

/**
 * An address as a browser resolves it: references decoded, tabs and line breaks dropped, and the
 * spaces and control characters at either end stripped.
 */
function asLoaded(address: string): string {
  return stripped(decodeReferences(address));
}

/** An already decoded address with its tabs and line breaks dropped and its ends stripped. */
function stripped(address: string): string {
  const loaded = address.replace(/[\t\n\r]/g, "");
  let start = 0;
  let end = loaded.length;
  while (start < end && loaded.charCodeAt(start) <= 0x20) start++;
  while (end > start && loaded.charCodeAt(end - 1) <= 0x20) end--;
  return loaded.slice(start, end);
}

/**
 * Image references a reader may see. Fenced code, HTML comments and inline code spans (which
 * never cross a blank line) are never shown, so they are skipped. Images the reader may not see
 * as images are returned with `uncertain`, so the caller can still check them without counting
 * them as diagrams.
 */
export function findImageRefs(markdown: string): ImageRef[] {
  return scanImageRefs(markdown).refs;
}

/**
 * The image references of a document, and whether a reader may miss what starts on a given line:
 * a style sheet in the page may hide anything, a comment left open hides the rest of the
 * document, and some elements (a closed <details>, a hidden <div>) hide what they hold.
 */
function scanImageRefs(markdown: string): {
  refs: ImageRef[];
  hidden: (line: number) => boolean;
} {
  // Inline code shows as text: each of its characters becomes one that means nothing to the
  // scans below, its line breaks kept, so nothing joins across it and every line stays put. A
  // span opens only at the start of a backtick run: after a character that is neither a backtick
  // nor a backslash, after an even number of backslashes, or after an escaped backtick. A
  // backtick after an odd number of backslashes is escaped and opens nothing.
  const shown = withoutFencedCode(expandIndentTabs(markdown.replace(/\r\n?/g, "\n"))).replace(
    /(?<=(?:^|[^\\`])|(?:^|[^\\])(?:\\\\)+|(?:^|[^\\])(?:\\\\)*\\`)(`+)(?!`)(?:[^\n]|\n(?![ \t]*\n))*?[^`]\1(?!`)/g,
    (span: string) => span.replace(/[^\n]/g, "\u{E000}"),
  );
  // A `<` after an odd number of backslashes is escaped Markdown text.
  const escapedIn = (source: string, index: number) =>
    (/\\*$/.exec(source.slice(Math.max(0, index - 64), index))?.[0].length ?? 0) % 2 === 1;
  // Comments are blanked out, their line breaks kept so lines stay where they were. A `<!--`
  // inside a tag or the text of a raw-text element opens no comment. One whose `<` is escaped is
  // Markdown text, so its images are read; inside raw HTML it would be a real comment, so they
  // are checked but not counted.
  const markup = markupRanges(shown, (index) => escapedIn(shown, index));
  const inMarkup = (index: number) => markup.some(([from, to]) => index > from && index < to);
  const escapedComments: Array<[number, number]> = [];
  let text = "";
  let copied = 0;
  for (let at = shown.indexOf("<!--"); at >= 0; at = shown.indexOf("<!--", at + 1)) {
    if (inMarkup(at)) continue;
    const close = shown.indexOf("-->", at + 4);
    if (close < 0) break;
    const end = close + 3;
    if (escapedIn(shown, at)) escapedComments.push([at, end]);
    else {
      text += shown.slice(copied, at) + shown.slice(at, end).replace(/[^\n]/g, " ");
      copied = end;
    }
    at = end - 1;
  }
  text += shown.slice(copied);
  const refs: Array<{
    alt: string;
    path: string;
    index: number;
    markdown: boolean;
    hiddenDefinition?: boolean;
    resource?: boolean;
    insideAlt?: boolean;
    replaced?: boolean;
    base?: boolean;
    unknownReference?: boolean;
  }> = [];
  const blocks = blockLines(text.split("\n"));
  const lineOf = (index: number) => text.slice(0, index).split("\n").length - 1;
  // Reference-style images (`![alt][ref]`, `![ref][]`, `![ref]`) resolve through `[ref]: target`.
  // Labels match case-insensitively by Unicode case folding (`ß` matches `ss`), as CommonMark does.
  const reference = (label: string) =>
    label.trim().replace(/\s+/g, " ").toLowerCase().toUpperCase();
  // A definition inside a raw HTML block is shown as text, so an image using it is not counted.
  const definitions = new Map<string, { target: string; hidden: boolean }>();
  // Definitions are read from each line as its container sees it, so one inside a blockquote or
  // list item counts too; the address may stand on the line after the label. A definition cannot
  // interrupt a paragraph: one that continues a paragraph is text, so an image using it is
  // checked but not counted. A definition that opens a paragraph lets the next one follow it.
  const bodies = blocks.map((block) => block.body).join("\n");
  const definitionEnds = new Set<number>();
  // The lines a definition takes: image syntax there is part of its address or title.
  const definitionLines = new Set<number>();
  // Nothing but an optional title, on the same line or the next, may follow the address; otherwise
  // the line is text. A bare address must balance its parentheses, and a title cannot hold a
  // blank line.
  for (const match of bodies.matchAll(
    /^ {0,3}\[((?:\\.|[^\]\\])+)\]:[ \t]*(?:\n[ \t]*)?(?:<((?:\\.|[^<>\\\n])*)>|([^\s<]\S*))(?:(?:[ \t]+|[ \t]*\n[ \t]*)(?:"(?:\\.|(?!\n[ \t]*\n)[^"\\])*"|'(?:\\.|(?!\n[ \t]*\n)[^'\\])*'|\((?:\\.|(?!\n[ \t]*\n)[^()\\])*\))[ \t]*$|[ \t]*$)/gm,
  )) {
    if (match[3] !== undefined && !balancedParentheses(match[3])) continue;
    const label = reference(match[1] ?? "");
    const start = match.index ?? 0;
    const line = bodies.slice(0, start).split("\n").length - 1;
    const last = bodies.slice(0, start + match[0].length).split("\n").length - 1;
    // A part on a later line must continue the definition's paragraph in the same containers.
    // On a lazy line renderers disagree, so the definition is checked but not counted.
    const later = blocks.slice(line + 1, last + 1);
    if (later.some((block) => !block.continues)) continue;
    for (let number = line; number <= last; number++) definitionLines.add(number);
    const opensParagraph = !blocks[line]?.continues || definitionEnds.has(line - 1);
    if (opensParagraph) definitionEnds.add(last);
    if (!definitions.has(label))
      definitions.set(label, {
        target: asLoaded(unescapeMarkdown(match[2] ?? match[3] ?? "")),
        hidden: blocks[line]?.html === true || !opensParagraph || later.some((block) => block.lazy),
      });
  }
  // Images, inline and reference-style. An image starts at a `!` that is not escaped (`\![a](b)`
  // shows a `!` and a link). Its alt text may hold balanced brackets to any depth and ends at its
  // matching `]`, never across a blank line. An inline destination may follow in `(…)`: `<…>`, or
  // a run without spaces that may hold balanced parentheses, then only an optional quoted or
  // parenthesised title. Otherwise a `[label]` may follow (`[]` reuses the alt text), or the alt
  // text itself is the label. An image inside another image's alt text is not drawn.
  const alts: Array<[number, number]> = [];
  for (let start = text.indexOf("!["); start >= 0; start = text.indexOf("![", start + 1)) {
    if ((/\\*$/.exec(text.slice(Math.max(0, start - 64), start))?.[0].length ?? 0) % 2) continue;
    let close = -1;
    for (let at = start + 1, depth = 0; at < text.length; at++) {
      const char = text[at];
      if (char === "\\") at++;
      else if (char === "\n" && /^[ \t]*(?:\n|$)/.test(text.slice(at + 1))) break;
      else if (char === "[") depth++;
      else if (char === "]" && --depth === 0) {
        close = at;
        break;
      }
    }
    if (close < 0) continue;
    const alt = text.slice(start + 2, close);
    const insideAlt = alts.some(([from, to]) => start > from && start < to);
    alts.push([start, close]);
    const destination =
      text[close + 1] === "(" ? inlineDestination(text, close + 1)?.destination : undefined;
    if (destination !== undefined) {
      // An empty destination is still an image, one that loads nothing.
      if (destination)
        refs.push({ alt, path: asLoaded(destination), index: start, markdown: true, insideAlt });
      continue;
    }
    const label = /^\[((?:\\.|[^[\]\\])*)\]/.exec(text.slice(close + 1))?.[1];
    const definition = definitions.get(reference(label || alt));
    if (definition)
      refs.push({
        alt,
        path: definition.target,
        index: start,
        markdown: true,
        hiddenDefinition: definition.hidden,
        insideAlt,
      });
  }
  const attribute = (tag: string, name: string) => htmlAttributes(tag).get(name);
  // An <img> source is a reference like any other, and the only HTML one that counts as a diagram.
  // Every other address a visible element would load is checked too: each candidate of an
  // attribute that loads on its element (LOADING_ATTRIBUTES) and every CSS url() in its style.
  // Text attributes, a link's address (an <a>, or a <link> that only describes the page), and
  // references to a part of the page itself (`#id`) are left alone.
  // A tag ends at the first `>` outside a quoted attribute value.
  // CSS loads url() addresses, @import strings, and the plain string candidates of image-set().
  // CSS drops its comments, so an address written in one loads nothing; they are blanked to
  // spaces, keeping every offset in place.
  const cssUrls = (written: string) => {
    // CSS reads escapes, strings and comments in one pass: a `/*` inside a string opens no
    // comment, an escaped quote does not end its string, and one outside a string opens none.
    // Comments are blanked; each string is set aside to be read with its own escapes, and each
    // escape elsewhere is read as the character it names (`u\72l(` is `url(`). One that names a
    // parenthesis or a quote stands for that character, never a delimiter, so `url(a\)b.svg)`
    // loads `a)b.svg` and `url\(` opens no function. Text inside a string that is not a url(),
    // image-set() or @import argument loads nothing. Offsets may shift a little, which only moves
    // a resource's line, and resources are never counted. A string left open runs to the end and
    // keeps its value; one a line break cuts short is bad, names no address, and what follows the
    // break is read as CSS again.
    const strings: string[] = [];
    const literal = ["(", ")", '"', "'"];
    const css = written.replace(
      /\\(?:[0-9a-f]{1,6}[ \t\n\r\f]?|[^\n\r\f0-9a-f])|"(?:\\[\s\S]|\\$|[^"\\\n\r\f])*("|(?=[\n\r\f])|$)|'(?:\\[\s\S]|\\$|[^'\\\n\r\f])*('|(?=[\n\r\f])|$)|\/\*[\s\S]*?(?:\*\/|$)/gi,
      (token: string, double?: string, single?: string, offset = 0) => {
        if (token.startsWith("/*")) return token.replace(/[^\n]/g, " ");
        if (token.startsWith("\\")) {
          const char = decodeCssEscapes(token);
          const kept = literal.indexOf(char);
          return kept < 0 ? char : String.fromCodePoint(0xe002 + kept);
        }
        const close = double ?? single ?? "";
        if (close === "" && offset + token.length < written.length) return "''";
        strings.push(token.slice(1, token.length - close.length));
        return `"\u{E001}${strings.length - 1}\u{E001}"`;
      },
    );
    // An unquoted address with the characters its escapes stand for.
    const unquoted = (address: string) =>
      address.replace(
        /[\u{E002}-\u{E005}]/gu,
        (kept) => literal[(kept.codePointAt(0) ?? 0) - 0xe002] ?? "",
      );
    // A string's value: escapes read, and an escaped line break dropped as a continuation.
    const stringValue = (index?: string) =>
      decodeCssEscapes((strings[Number(index)] ?? "").replace(/\\(?:\r\n|[\n\r\f])/g, ""));
    return [
      // A quoted url() argument is the whole string; an unquoted one ends at the first `)`, or at
      // the end, which closes it too. A function is named by a whole identifier, so `curl(` is no
      // `url(`.
      ...[
        ...css.matchAll(
          /(?<![\w\-\u{80}-\u{10FFFF}])url\(\s*(?:"\u{E001}(\d+)\u{E001}"|([^)"']*?))\s*(?:\)|$)|@import\s+"\u{E001}(\d+)\u{E001}"/giu,
        ),
      ].map((url) => ({
        path:
          url[1] !== undefined
            ? stringValue(url[1])
            : url[3] !== undefined
              ? stringValue(url[3])
              : unquoted(url[2] ?? ""),
        offset: url.index ?? 0,
      })),
      // An image-set() runs to its balanced `)`, nested functions included; strings are set
      // aside, so a parenthesis inside one counts for nothing. Only a string at its top level is
      // an image: one inside a function, url() or the type() of an option, is not.
      ...[...css.matchAll(/(?<![\w\-\u{80}-\u{10FFFF}])(?:-webkit-)?image-set\(/giu)].flatMap(
        (set) => {
          const from = (set.index ?? 0) + set[0].length;
          const found: Array<{ path: string; offset: number }> = [];
          const string = /"\u{E001}(\d+)\u{E001}"/uy;
          for (let at = from, depth = 1; at < css.length; at++) {
            if (css[at] === "(") depth++;
            else if (css[at] === ")" && --depth === 0) break;
            else if (css[at] === '"' && depth === 1) {
              string.lastIndex = at;
              const candidate = string.exec(css);
              if (candidate) found.push({ path: stringValue(candidate[1]), offset: at });
            }
          }
          return found;
        },
      ),
    ];
  };
  const outsidePage = (address: string) => address !== "" && !address.startsWith("#");
  // A `<` after an odd number of backslashes is escaped Markdown text, not a tag; inside a raw HTML
  // block a backslash is just a character, so the tag after it is real.
  const escaped = (index: number) => escapedIn(text, index) && !blocks[lineOf(index)]?.html;
  // Raw text (script, style, iframe text and the like): a tag there is text, and an image there is
  // not shown.
  const content = contentRanges(text, escaped);
  const { raw } = content;
  // A style sheet may hide any image, and which ones is not worked out here, so a page with one
  // counts none.
  let styled = false;
  // An image written inside a tag, in an attribute value, is part of the tag and not shown.
  const tags: Array<[number, number]> = [];
  // The addresses a srcset offers, read as the HTML parser reads them. An address runs to the next
  // whitespace: a comma inside it is part of it (`a,b.svg`), the commas that end it are not. Its
  // descriptors run to the next comma outside parentheses. A browser decodes the attribute before
  // it reads it, so `&#44;` is a comma too.
  const candidates = (srcset: string) => {
    const value = decodeReferences(srcset);
    const found: string[] = [];
    const space = (char?: string) => char !== undefined && /[\t\n\f\r ]/.test(char);
    let at = 0;
    const skip = () => {
      while (at < value.length && (space(value[at]) || value[at] === ",")) at++;
    };
    for (skip(); at < value.length; skip()) {
      const start = at;
      while (at < value.length && !space(value[at])) at++;
      const written = value.slice(start, at);
      const address = written.replace(/,+$/, "");
      found.push(stripped(address));
      if (address !== written) continue;
      for (let parens = false; at < value.length; at++) {
        if (parens) parens = value[at] !== ")";
        else if (value[at] === "(") parens = true;
        else if (value[at] === ",") break;
      }
    }
    return found.filter((candidate) => candidate !== "");
  };
  // The file an address names, as the check finds it: without its query or fragment, decoded and
  // normalised (`./d.svg?v=1` is `d.svg`).
  const fileOf = (address: string) => {
    const bare = address.replace(/[?#][\s\S]*$/, "");
    try {
      return path.posix.normalize(decodeURIComponent(bare));
    } catch {
      return bare;
    }
  };
  // A <source> with a srcset before an <img> in the same <picture> may be shown in its place,
  // unless every candidate it offers is the img's own file.
  const liveTags = (pattern: RegExp) =>
    [...text.matchAll(pattern)].filter((match) => {
      const at = match.index ?? 0;
      return !escaped(at) && !raw.some(([from, to]) => at >= from && at < to);
    });
  const pictures = liveTags(new RegExp(`<picture(?=[\\s/>])${TAG_BODY}>`, "gi")).map((match) => {
    const at = match.index ?? 0;
    return [at, elementEnd(text, "picture", at + match[0].length)] as const;
  });
  const sources = liveTags(new RegExp(`<source(?=[\\s/>])${TAG_BODY}>`, "gi")).map((match) => ({
    at: match.index ?? 0,
    offered: candidates(htmlAttributes(match[0]).get("srcset") ?? ""),
  }));
  const afterPictureSource = (index: number, file: string) =>
    pictures.some(
      ([from, to]) =>
        index > from &&
        index < to &&
        sources.some(
          ({ at, offered }) =>
            at > from && at < index && offered.some((candidate) => fileOf(candidate) !== file),
        ),
    );
  for (const match of text.matchAll(
    new RegExp(`<([a-z][a-z0-9-]*)(?=[\\s/>])${TAG_BODY}>`, "gi"),
  )) {
    const [tag] = match;
    const index = match.index ?? 0;
    // A tag-shaped string in raw text loads nothing.
    if (escaped(index) || raw.some(([from, to]) => index >= from && index < to)) continue;
    tags.push([index, index + tag.length]);
    // An element that loads only as SVG (`svg:` in LOADING_ATTRIBUTES) does so inside <svg>.
    const inSvg = inForeignContent(content, index);
    // Outside <svg>, HTML reads an <image> start tag as <img>.
    const writtenName = (match[1] ?? "").toLowerCase();
    const name = writtenName === "image" && !inSvg ? "img" : writtenName;
    // Relations are read as the browser reads the attribute, references decoded.
    const relations =
      name === "link"
        ? decodeReferences(attribute(tag, "rel") ?? "")
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean)
        : [];
    if (relations.includes("stylesheet")) styled = true;
    const describes =
      name === "link" && relations.every((relation) => DESCRIPTIVE_LINK_RELATIONS.has(relation));
    const written = name === "img" ? attribute(tag, "src") : undefined;
    const src = written === undefined ? undefined : asLoaded(written);
    // A browser that reads srcset may show one of its candidates instead of src, so src counts
    // only when every candidate names that same file and no picture source offers another. In an
    // attribute a browser also decodes some references written without their `;` (`&amp/` is
    // `&/`), which are read here as written, so a src holding one is not counted either; nor is
    // an image given no area.
    const file = fileOf(src ?? "");
    const replaced =
      afterPictureSource(index, file) ||
      /&[a-z][a-z0-9]*(?![a-z0-9;=])/i.test(written ?? "") ||
      (src !== undefined && noArea(tag)) ||
      candidates(attribute(tag, "srcset") ?? "").some((candidate) => fileOf(candidate) !== file);
    // A base element moves where every relative address loads from, so it is reported as such
    // rather than checked as a file.
    const base = name === "base" ? attribute(tag, "href") : undefined;
    if (base !== undefined) {
      refs.push({ alt: "", path: asLoaded(base), index, markdown: false, base: true });
      continue;
    }
    if (src)
      refs.push({ alt: attribute(tag, "alt") ?? "", path: src, index, markdown: false, replaced });
    const seen = new Set(src ? [src] : []);
    const resource = (path: string) => {
      if (!outsidePage(path) || seen.has(path)) return;
      seen.add(path);
      refs.push({ alt: "", path, index, markdown: false, resource: true });
    };
    for (const [attr, elements] of LOADING_ATTRIBUTES) {
      const loads =
        (elements.has(name) || (inSvg && elements.has(`svg:${name}`))) &&
        // An <input> loads its src only as an image button.
        (name !== "input" ||
          attr !== "src" ||
          decodeReferences(attribute(tag, "type") ?? "")
            .trim()
            .toLowerCase() === "image");
      const value =
        (name === "img" && attr === "src") || !loads || (describes && attr === "href")
          ? undefined
          : attribute(tag, attr);
      if (value === undefined) continue;
      (attr.endsWith("srcset") ? candidates(value) : [asLoaded(value)]).forEach(resource);
    }
    // CSS reads a decoded tab or line break as whitespace (`u&#9;rl(` is no `url(`); only the
    // address it finds drops them, as a browser does when it loads it.
    // A named reference the check does not decode (`url&lpar;`, `src&equals;`), or one written
    // without its `;` (`&quot`), may stand for CSS or markup a browser reads, so CSS in an
    // attribute or an iframe's srcdoc holding one is reported as well as read.
    const unreadable = (value: string) => {
      for (const reference of value.matchAll(/&([a-z][a-z0-9]*)(;|(?![a-z0-9=]))/gi))
        if (reference[2] !== ";" || !NAMED_REFERENCES.has(reference[1] ?? ""))
          refs.push({
            alt: "",
            path: reference[0],
            index,
            markdown: false,
            resource: true,
            unknownReference: true,
          });
      return decodeReferences(value);
    };
    for (const url of cssUrls(unreadable(attribute(tag, "style") ?? "")))
      resource(stripped(url.path));
    // In SVG, a presentation attribute such as fill or filter may load a url() too.
    for (const attr of inSvg || name === "svg" ? SVG_URL_ATTRIBUTES : [])
      for (const url of cssUrls(unreadable(attribute(tag, attr) ?? "")))
        resource(stripped(url.path));
    // An SVG animation sets its target's attribute to each of its values, so when it animates an
    // address (href) or a presentation attribute that takes url(), those values load too. HTML
    // decodes references before SMIL splits `values` at `;`, so `&#59` separates values too.
    const animated =
      inSvg && /^(?:set|animate|animatemotion|animatecolor|animatetransform)$/.test(name)
        ? decodeReferences(attribute(tag, "attributename") ?? "")
            .trim()
            .toLowerCase()
        : "";
    const address = animated === "href" || animated === "xlink:href";
    if (address || SVG_URL_ATTRIBUTES.includes(animated)) {
      const decoded = (attr: string) => {
        const value = attribute(tag, attr);
        return value === undefined ? [] : [unreadable(value)];
      };
      const values = [
        ...decoded("to"),
        ...decoded("from"),
        ...decoded("by"),
        ...decoded("values").flatMap((value) => value.split(";")),
      ];
      for (const value of values)
        if (address) resource(stripped(value));
        else for (const url of cssUrls(value)) resource(stripped(url.path));
    }
    // An iframe's srcdoc is a page of its own, and what it loads is checked too.
    const srcdoc = name === "iframe" ? attribute(tag, "srcdoc") : undefined;
    // A base element there moves where that page's addresses load from, so it is reported too.
    for (const inner of srcdoc ? findImageRefs(unreadable(srcdoc)) : []) {
      if (inner.base) refs.push({ alt: "", path: inner.path, index, markdown: false, base: true });
      else if (inner.unknownReference)
        refs.push({
          alt: "",
          path: inner.path,
          index,
          markdown: false,
          resource: true,
          unknownReference: true,
        });
      else resource(inner.path);
    }
  }
  // A style sheet in the page loads its addresses too.
  for (const sheet of text.matchAll(
    new RegExp(`(<style\\b${TAG_BODY}>)([\\s\\S]*?)(?:<\\/style\\s*>|$)`, "gi"),
  )) {
    // A style element written inside script or textarea text is only text.
    const opening = sheet.index ?? 0;
    if (escaped(opening) || raw.some(([from, to]) => opening >= from && opening < to)) continue;
    // One with no rules hides nothing, nor does one that <svg> or <math> closes with `/>`.
    const closed = (sheet[1] ?? "").endsWith("/>") && inForeignContent(content, opening);
    if (!closed && (sheet[2] ?? "").trim() !== "") styled = true;
    const start = opening + (sheet[1] ?? "").length;
    for (const url of cssUrls(sheet[2] ?? "")) {
      const address = asLoaded(url.path);
      if (outsidePage(address))
        refs.push({
          alt: "",
          path: address,
          index: start + url.offset,
          markdown: false,
          resource: true,
        });
    }
  }
  // Link metadata shows no image: a link's destination and title, and an autolink.
  const metadata: Array<[number, number]> = [];
  for (let at = text.indexOf("]("); at >= 0; at = text.indexOf("](", at + 1)) {
    const end = escapedIn(text, at) ? undefined : inlineDestination(text, at + 1)?.end;
    if (end !== undefined) metadata.push([at + 1, end]);
  }
  for (const autolink of text.matchAll(/<[a-z][a-z0-9+.-]{1,31}:[^\s<>]*>/gi)) {
    const start = autolink.index ?? 0;
    if (!escapedIn(text, start)) metadata.push([start, start + autolink[0].length]);
  }
  // A comment left open hides the rest of the document; what follows is checked but not counted.
  // An escaped opener is Markdown text, except inside a raw HTML block, where it is a real one.
  const closedEscaped = new Set(escapedComments.map(([from]) => from));
  let openComment = text.indexOf("<!--");
  while (
    openComment >= 0 &&
    (escaped(openComment) || closedEscaped.has(openComment) || inMarkup(openComment))
  )
    openComment = text.indexOf("<!--", openComment + 1);
  const unseen = hiddenHtmlRanges(text, escaped, content);
  const lineStarts = [0];
  for (let at = text.indexOf("\n"); at >= 0; at = text.indexOf("\n", at + 1))
    lineStarts.push(at + 1);
  const hidden = (line: number) => {
    const index = lineStarts[line] ?? text.length;
    return (
      styled ||
      (openComment >= 0 && index > openComment) ||
      unseen.some(([start, end]) => index >= start && index < end)
    );
  };
  const found = refs
    .sort((a, b) => a.index - b.index)
    .map(
      ({
        alt,
        path: ref,
        index,
        markdown,
        hiddenDefinition,
        resource,
        insideAlt,
        replaced,
        base,
        unknownReference,
      }) => {
        const number = lineOf(index);
        // Indented code is judged inside the line's blockquote or list item; a line that continues
        // a paragraph is never code.
        const block = blocks[number];
        const indented = !block?.continues && /^(?: {4}| {0,3}\t)/.test(block?.body ?? "");
        const afterOpenComment = openComment >= 0 && index > openComment;
        return {
          alt,
          path: ref,
          uncertain:
            styled ||
            indented ||
            afterOpenComment ||
            hiddenDefinition === true ||
            resource === true ||
            replaced === true ||
            insideAlt === true ||
            escapedComments.some(([from, to]) => index >= from && index < to) ||
            unseen.some(([start, end]) => index >= start && index < end) ||
            raw.some(([start, end]) => index >= start && index < end) ||
            metadata.some(([start, end]) => index > start && index < end) ||
            (markdown && definitionLines.has(number)) ||
            (markdown && tags.some(([start, end]) => index > start && index < end)) ||
            (markdown ? block?.html === true : block?.rawText === true) ||
            base === true,
          ...(base ? { base: true as const } : {}),
          ...(unknownReference ? { unknownReference: true as const } : {}),
        };
      },
    );
  return { refs: found, hidden };
}

/**
 * A start tag's attributes, read as a browser reads them: names end at whitespace, `/`, `>` or
 * `=`; values are quoted or run to the next whitespace; a `/` between attributes is skipped
 * (`<img/src=a>`); the first of two same-named attributes wins.
 */
function htmlAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const text = tag.replace(/>$/, "");
  let at = /^<[a-z][a-z0-9-]*/i.exec(text)?.[0].length ?? text.length;
  const space = (char: string | undefined) => char !== undefined && /\s/.test(char);
  while (at < text.length) {
    while (at < text.length && (space(text[at]) || text[at] === "/")) at++;
    if (at >= text.length) break;
    const start = at;
    // A name's first character may be `=`; after that `=` starts the value.
    do at++;
    while (at < text.length && !space(text[at]) && text[at] !== "/" && text[at] !== "=");
    const name = text.slice(start, at).toLowerCase();
    let next = at;
    while (space(text[next])) next++;
    let value = "";
    if (text[next] === "=") {
      at = next + 1;
      while (space(text[at])) at++;
      const quote = text[at];
      if (quote === '"' || quote === "'") {
        const end = text.indexOf(quote, at + 1);
        value = text.slice(at + 1, end < 0 ? text.length : end);
        at = end < 0 ? text.length : end + 1;
      } else {
        const from = at;
        while (at < text.length && !space(text[at])) at++;
        value = text.slice(from, at);
      }
    }
    if (!attributes.has(name)) attributes.set(name, value);
  }
  return attributes;
}

/**
 * Elements whose content a browser reads as text: a tag there is no tag, and an image there is
 * not shown. <noscript> is not one: with scripting off its content is shown, so it is only hidden.
 */
const RAW_TEXT_ELEMENTS = new Set([
  "script",
  "style",
  "textarea",
  "title",
  "iframe",
  "xmp",
  "noembed",
  "noframes",
  "plaintext",
]);
const RAW_TEXT_NAMES = [...RAW_TEXT_ELEMENTS].join("|");

/**
 * The body of an HTML tag up to its closing `>`, read as the HTML tokenizer reads it: a quote
 * delimits a value only when it opens one right after `=`; anywhere else (`src=a'b`) it is a
 * character like any other. A quoted value runs to its closing quote, `>` included.
 */
const TAG_BODY = `(?:[^>"'=]|=[\\t\\n\\f\\r ]*(?:"[^"]*"|'[^']*')|=(?![\\t\\n\\f\\r ]*["'])|["'])*`;

/**
 * Start and end tags that end <svg> or <math> content wherever it is not an integration point:
 * the parser leaves the foreign element there and reads the tag, and what follows, as HTML.
 * A <font> does so only with a color, face or size attribute.
 */
const BREAKOUT_TAGS =
  "b|big|blockquote|body|br|center|code|dd|div|dl|dt|em|embed|h[1-6]|head|hr|i|img|li|listing|menu|meta|nobr|ol|p|pre|ruby|s|small|span|strong|strike|sub|sup|table|tt|u|ul|var|font";

/**
 * Where the text of the raw-text element `name` whose start tag ends at `from` stops: at its end
 * tag, or the end of the page. Nothing ends <plaintext>, not even its own end tag.
 */
function rawTextEnd(text: string, name: string, from: number): number {
  if (name === "plaintext") return text.length;
  const close = text.slice(from).search(new RegExp(`</${name}[\\s/>]`, "i"));
  return close < 0 ? text.length : from + close;
}

/**
 * SVG elements whose href (or xlink:href) names a resource the browser may fetch: images, uses,
 * scripts, and the paint servers, filters and other elements that reference another document.
 */
const SVG_HREF_ELEMENTS = [
  "image",
  "use",
  "feimage",
  "script",
  "lineargradient",
  "radialgradient",
  "pattern",
  "filter",
  "textpath",
  "mpath",
  "cursor",
  "tref",
  "font-face-uri",
].map((name) => `svg:${name}`);

/**
 * The attributes a browser loads from, each with the elements it loads on (a base element's href
 * is reported on its own); on any other element it only holds text. An `svg:` element loads only
 * inside <svg> (an HTML <script> ignores href); an HTML <image> is read as <img>. `srcset`
 * and `imagesrcset` hold several candidates. Element names are lower-cased, SVG ones included.
 */
const LOADING_ATTRIBUTES: ReadonlyArray<[string, ReadonlySet<string>]> = [
  [
    "src",
    new Set([
      "img",
      "script",
      "iframe",
      "frame",
      "embed",
      "input",
      "video",
      "audio",
      "source",
      "track",
    ]),
  ],
  ["srcset", new Set(["img", "source"])],
  ["imagesrcset", new Set(["link"])],
  ["lowsrc", new Set(["img"])],
  ["dynsrc", new Set(["img"])],
  ["poster", new Set(["video"])],
  ["data", new Set(["object"])],
  ["codebase", new Set(["object", "applet"])],
  ["archive", new Set(["object", "applet"])],
  ["code", new Set(["applet"])],
  ["background", new Set(["body", "table", "td", "th"])],
  ["manifest", new Set(["html"])],
  ["icon", new Set(["command", "menuitem"])],
  ["href", new Set(["link", ...SVG_HREF_ELEMENTS])],
  ["xlink:href", new Set(SVG_HREF_ELEMENTS)],
];

/** SVG presentation attributes whose value may be a url() the browser loads. */
const SVG_URL_ATTRIBUTES = [
  "fill",
  "stroke",
  "filter",
  "clip-path",
  "mask",
  "marker-start",
  "marker-mid",
  "marker-end",
  "cursor",
];

/**
 * Link relations that only describe the page. A <link> whose relations are all among these (or
 * that has none) loads nothing, so its href is left alone; any other relation, an unknown one
 * included, has it checked.
 */
const DESCRIPTIVE_LINK_RELATIONS = new Set([
  "alternate",
  "author",
  "bookmark",
  "canonical",
  "external",
  "help",
  "license",
  "me",
  "next",
  "nofollow",
  "noopener",
  "noreferrer",
  "prev",
  "search",
  "tag",
]);

/** CSS text with its escapes read as the characters they stand for: `n\6f ne` is `none`. */
function decodeCssEscapes(css: string): string {
  return css.replace(
    /\\([0-9a-f]{1,6})[ \t\n\r\f]?|\\([^\n0-9a-f])/gi,
    (_, hex?: string, char?: string) => {
      if (char !== undefined) return char;
      const code = Number.parseInt(hex ?? "", 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "\u{FFFD}";
    },
  );
}

/** A CSS size: a keyword, or a number with an optional unit; a negative one is invalid (`-0` is zero). */
const SIZE_VALUE =
  /^(?:auto|none|min-content|max-content|fit-content|(?:\+?(?:\d+\.?\d*|\.\d+)|-(?:0+\.?0*|\.0+))(?:[a-z]+|%)?)$/i;

/** Values CSS accepts for the properties that can hide an element, besides the global ones. */
const KNOWN_VALUES: Record<string, RegExp> = {
  display:
    /^(?:none|contents|(?:block|inline|run-in|flow|flow-root|table|flex|grid|ruby|list-item|math)(?:\s+(?:block|inline|run-in|flow|flow-root|table|flex|grid|ruby|list-item|math))*|inline-(?:block|flex|grid|table)|table-[a-z-]+|ruby-[a-z-]+)$/i,
  visibility: /^(?:visible|hidden|collapse)$/i,
  opacity: /^[+-]?(?:\d+\.?\d*|\.\d+)%?$/,
  width: SIZE_VALUE,
  height: SIZE_VALUE,
  "max-width": SIZE_VALUE,
  "max-height": SIZE_VALUE,
};

/**
 * The value that applies for each property of a style attribute, read after CSS drops comments;
 * a custom property such as `--display` or text inside a string value does not count. A later
 * declaration of a property wins unless an earlier one is `!important` and it is not; one whose
 * value CSS may not accept (`display: bogus`) is dropped and displaces nothing.
 */
function appliedStyle(style: string): Map<string, string> {
  // Escapes, strings and comments are read in one pass, so a `/*` inside a string opens no
  // comment, and an escaped quote (`a\"`) opens no string. Escapes are kept to be read below. A
  // string runs to its quote, to a line break that cuts it short, or to the end.
  const css = style.replace(
    /\\[\s\S]|"(?:\\[\s\S]|\\$|[^"\\\n\r\f])*(?:"|(?=[\n\r\f])|$)|'(?:\\[\s\S]|\\$|[^'\\\n\r\f])*(?:'|(?=[\n\r\f])|$)|\/\*[\s\S]*?(?:\*\/|$)/g,
    (token) => (token.startsWith("\\") ? token : token.startsWith("/*") ? " " : '""'),
  );
  const applied = new Map<string, { value: string; important: boolean }>();
  // Declarations end at each `;` that no backslash escapes and no (), [] or {} block holds, before
  // escapes are read: `a\;b` is one declaration, and so is `--x:f(a;b)`.
  const declarations: string[] = [];
  let depth = 0;
  let from = 0;
  for (let at = 0; at < css.length; at++) {
    const char = css.charAt(at);
    if (char === "\\") at++;
    else if ("([{".includes(char)) depth++;
    else if (")]}".includes(char)) depth = Math.max(0, depth - 1);
    else if (char === ";" && depth === 0) {
      declarations.push(css.slice(from, at));
      from = at + 1;
    }
  }
  declarations.push(css.slice(from));
  for (const written of declarations) {
    const declaration = decodeCssEscapes(written);
    const match = /^\s*([a-z-]+)\s*:\s*([\s\S]*?)\s*(!\s*important\s*)?$/i.exec(declaration);
    const property = (match?.[1] ?? "").toLowerCase();
    const value = match?.[2] ?? "";
    const important = match?.[3] !== undefined;
    const known =
      /^(?:inherit|initial|unset|revert|revert-layer)$/i.test(value) ||
      KNOWN_VALUES[property]?.test(value) === true;
    const previous = applied.get(property);
    if (!match || (previous && (!known || (previous.important && !important)))) continue;
    applied.set(property, { value, important });
  }
  return new Map([...applied].map(([property, { value }]) => [property, value]));
}

/**
 * Whether a style attribute hides its element: the `display: none`, `visibility: hidden` (or
 * `collapse`) or zero `opacity` declaration of its own that applies.
 */
function hiddenByStyle(style: string): boolean {
  const applied = appliedStyle(style);
  const value = (property: string) => applied.get(property) ?? "";
  return (
    /^none$/i.test(value("display")) ||
    /^(?:hidden|collapse)$/i.test(value("visibility")) ||
    (KNOWN_VALUES.opacity?.test(value("opacity")) === true &&
      Number.parseFloat(value("opacity")) <= 0)
  );
}

/**
 * Whether an img tag gives its image no area: a width or height attribute HTML reads as under one
 * pixel (`0`, ` 0px`, `0.5`), a zero width, height or maximum in its own style, or
 * `display: contents`, which an img, a replaced element, takes as `none`.
 */
function noArea(tag: string): boolean {
  const attributes = htmlAttributes(tag);
  const small = (written?: string) => {
    const number = /^[\t\n\f\r ]*(\d+(?:\.\d*)?|\.\d+)/.exec(decodeReferences(written ?? ""))?.[1];
    return number !== undefined && Number.parseFloat(number) < 1;
  };
  const style = appliedStyle(decodeReferences(attributes.get("style") ?? ""));
  const zero = (property: string) => {
    const value = style.get(property) ?? "";
    // Only a zero gives no area: a negative size is invalid and leaves the image its own.
    return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[a-z]+|%)?$/i.test(value) && Number.parseFloat(value) === 0;
  };
  return (
    small(attributes.get("width")) ||
    small(attributes.get("height")) ||
    ["width", "height", "max-width", "max-height"].some(zero) ||
    /^contents$/i.test(style.get("display") ?? "")
  );
}

/**
 * Tags that start an HTML block wherever a line begins with them: CommonMark's type 6, and `meta`,
 * which marked, the dashboard's renderer, also treats as one.
 */
const HTML_BLOCK_TAGS = new Set(
  (
    "address article aside base basefont blockquote body caption center col colgroup dd details " +
    "dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 " +
    "h6 head header hr html iframe legend li link main menu menuitem meta nav noframes ol optgroup " +
    "option p param search section summary table tbody td tfoot th thead title tr track ul"
  ).split(" "),
);

/** Whether a bare address balances its unescaped parentheses, as CommonMark requires. */
function balancedParentheses(text: string): boolean {
  let depth = 0;
  for (let at = 0; at < text.length; at++) {
    if (text[at] === "\\") at++;
    else if (text[at] === "(") depth++;
    else if (text[at] === ")" && --depth < 0) return false;
  }
  return depth === 0;
}

/** A destination as written, with its backslash escapes resolved (`a\(1\).svg` is `a(1).svg`). */
const unescapeMarkdown = (text: string) => text.replace(/\\([!-/:-@[-`{-~])/g, "$1");

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/**
 * Where tags and the text of raw-text elements (RAW_TEXT_ELEMENTS) stand, read in order with
 * comments skipped, so a `<!--` found inside one is known to open no comment. A tag whose `<` is
 * escaped is Markdown text.
 */
function markupRanges(
  source: string,
  escaped: (index: number) => boolean,
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const token = new RegExp(
    `<!--|<(${RAW_TEXT_NAMES})(?=[\\s/>])${TAG_BODY}>|<\\/?[a-z][a-z0-9-]*(?=[\\s/>])${TAG_BODY}>`,
    "gi",
  );
  for (let match = token.exec(source); match; match = token.exec(source)) {
    const start = match.index;
    if (escaped(start)) continue;
    if (match[0] === "<!--") {
      const close = source.indexOf("-->", start + 4);
      if (close < 0) break;
      token.lastIndex = close + 3;
      continue;
    }
    let end = start + match[0].length;
    if (match[1]) end = rawTextEnd(source, match[1].toLowerCase(), end);
    ranges.push([start, end]);
    token.lastIndex = end;
  }
  return ranges;
}

/** Where content a browser parses differently stands; see contentRanges. */
type Content = {
  raw: Array<[number, number]>;
  foreign: Array<[number, number]>;
  islands: Array<[number, number]>;
};

/**
 * Three kinds of content a browser parses differently: the text of raw-text elements
 * (RAW_TEXT_ELEMENTS, `raw`), never read as tags or shown as images, up to their end tag or the
 * end of the page; <svg> and <math> elements (`foreign`), whose content is markup where `/>`
 * closes any element, a <script> or <style> included; and the HTML integration points inside
 * them (`islands`), whose content is HTML again: <foreignObject>, <desc> and <title> in SVG, the
 * text elements and an <annotation-xml> with an HTML encoding in MathML. An <svg> or <math> in an island is foreign once
 * more, so the innermost range around a tag tells which one it is in (inForeignContent).
 */
function contentRanges(text: string, escaped: (index: number) => boolean): Content {
  const content: Content = { raw: [], foreign: [], islands: [] };
  const html = (from: number, to: number) => {
    const tags = new RegExp(`<(${RAW_TEXT_NAMES}|svg|math)(?=[\\s/>])${TAG_BODY}>`, "gi");
    tags.lastIndex = from;
    for (let match = tags.exec(text); match && match.index < to; match = tags.exec(text)) {
      const start = match.index;
      const name = (match[1] ?? "").toLowerCase();
      const inside = start + match[0].length;
      if (escaped(start)) continue;
      if (name === "svg" || name === "math") {
        if (!match[0].endsWith("/>")) tags.lastIndex = foreign(start, inside, name, to);
        continue;
      }
      tags.lastIndex = Math.min(rawTextEnd(text, name, inside), to);
      content.raw.push([inside, tags.lastIndex]);
    }
  };
  const foreign = (start: number, inside: number, name: string, limit: number) => {
    let end = Math.min(elementEnd(text, name, inside, true), limit);
    // Each namespace has its own integration points: in SVG an <annotation-xml> or <mi> is an SVG
    // element like any other, and in MathML a <desc> is a MathML one. Outside them, a breakout
    // tag ends the foreign content where it stands.
    const points = new RegExp(
      `<(${name === "svg" ? "foreignobject|desc|title" : "annotation-xml|mi|mo|mn|ms|mtext"})(?=[\\s/>])${TAG_BODY}>|<(?:(${BREAKOUT_TAGS})|\\/(?:br|p))(?=[\\s/>])${TAG_BODY}>`,
      "gi",
    );
    points.lastIndex = inside;
    for (let point = points.exec(text); point && point.index < end; point = points.exec(text)) {
      if (escaped(point.index)) continue;
      if (point[1] === undefined) {
        const font = point[2]?.toLowerCase() === "font";
        const attributes = htmlAttributes(point[0]);
        if (font && !["color", "face", "size"].some((attribute) => attributes.has(attribute)))
          continue;
        end = point.index;
        break;
      }
      if (point[0].endsWith("/>")) continue;
      // <annotation-xml> holds HTML only with an HTML encoding.
      const encoding = decodeReferences(htmlAttributes(point[0]).get("encoding") ?? "");
      if (
        (point[1] ?? "").toLowerCase() === "annotation-xml" &&
        !/^(?:text\/html|application\/xhtml\+xml)$/i.test(encoding.trim())
      )
        continue;
      const from = point.index + point[0].length;
      const close = Math.min(elementEnd(text, (point[1] ?? "").toLowerCase(), from), end);
      content.islands.push([from, close]);
      html(from, close);
      points.lastIndex = close;
    }
    content.foreign.push([start, end]);
    return end;
  };
  html(0, text.length);
  return content;
}

/** Whether the tag at `index` is inside <svg> or <math> content, outside any HTML island in it. */
function inForeignContent({ foreign, islands }: Content, index: number): boolean {
  let innermost = -1;
  let inForeign = false;
  for (const [from, to] of foreign)
    if (index > from && index < to && from > innermost) [innermost, inForeign] = [from, true];
  for (const [from, to] of islands)
    if (index >= from && index < to && from > innermost) [innermost, inForeign] = [from, false];
  return inForeign;
}

/**
 * Stretches of the page HTML never shows: <template>, <noscript> and <select> content, a
 * <details> (all but its summary) or <dialog> without `open`, and any element marked `hidden` or
 * styled `display: none` / `visibility: hidden`, up to its matching end tag (or the end of the
 * page). Images there are checked but not counted.
 */
function hiddenHtmlRanges(
  text: string,
  escaped: (index: number) => boolean,
  content: Content,
): Array<[number, number]> {
  const { raw } = content;
  const ranges: Array<[number, number]> = [];
  // A tag-shaped string inside raw text is no tag.
  const skipped = (start: number) =>
    escaped(start) || raw.some(([from, to]) => start >= from && start < to);
  for (const match of text.matchAll(
    new RegExp(`<([a-z][a-z0-9-]*)(?=[\\s/>])${TAG_BODY}>`, "gi"),
  )) {
    const [tag] = match;
    const name = (match[1] ?? "").toLowerCase();
    const start = match.index ?? 0;
    if (skipped(start)) continue;
    const attributes = htmlAttributes(tag);
    // HTML ignores `/>` on an ordinary element, so `<div hidden/>` stays open; only a void
    // element, or an element inside <svg> or <math> (or one of those itself), ends there.
    const inForeign = name === "svg" || name === "math" || inForeignContent(content, start);
    const hidden =
      name === "template" ||
      // SVG never draws the content of its <desc> and <title>.
      (inForeign && (name === "desc" || name === "title")) ||
      name === "noscript" ||
      // HTML draws nothing inside a <select> but its options' text.
      name === "select" ||
      attributes.has("hidden") ||
      // A browser decodes character references in an attribute before CSS reads it.
      hiddenByStyle(decodeReferences(attributes.get("style") ?? ""));
    const collapsed = (name === "details" || name === "dialog") && !attributes.has("open");
    if (!hidden && !collapsed) continue;
    if (VOID_ELEMENTS.has(name) || (inForeign && tag.endsWith("/>"))) {
      ranges.push([start, start + tag.length]);
      continue;
    }
    const from = start + tag.length;
    const end = elementEnd(text, name, from, inForeign);
    // A closed <details> still shows its summary. One that is the first thing in it is left out of
    // the range; one further in is treated as hidden with the rest.
    const summary =
      !hidden && name === "details"
        ? new RegExp(`^\\s*<summary(?=[\\s/>])${TAG_BODY}>`, "i").exec(text.slice(from, end))
        : null;
    if (summary) {
      const shown = from + summary[0].length;
      // A summary left open runs to the end of its details.
      ranges.push([start, shown], [Math.min(elementEnd(text, "summary", shown), end), end]);
      continue;
    }
    ranges.push([start, end]);
  }
  return ranges;
}

/**
 * Where the element named `name` whose start tag ends at `from` ends: at its matching end tag,
 * found among whole tags (so a `</div>` inside a quoted attribute value is not one), skipping the
 * text of raw-text elements and counting nested elements of the same name (inside <svg> or
 * <math>, one that closes itself with `/>` does not nest); or at the end of the page.
 */
function elementEnd(text: string, name: string, from: number, foreign = false): number {
  const tags = new RegExp(`<(\\/?)([a-z][a-z0-9-]*)(?=[\\s/>])${TAG_BODY}>`, "gi");
  tags.lastIndex = from;
  let depth = 1;
  for (let next = tags.exec(text); next; next = tags.exec(text)) {
    const inner = (next[2] ?? "").toLowerCase();
    // Outside <svg> and <math>, raw text is skipped, and so is a nested <svg> or <math>.
    if (!foreign && !next[1] && RAW_TEXT_ELEMENTS.has(inner)) {
      tags.lastIndex = rawTextEnd(text, inner, tags.lastIndex);
      if (tags.lastIndex >= text.length) return text.length;
      continue;
    }
    if (!foreign && !next[1] && /^(?:svg|math)$/.test(inner) && !next[0].endsWith("/>")) {
      tags.lastIndex = elementEnd(text, inner, tags.lastIndex, true);
      continue;
    }
    // Inside <svg> or <math>, `/>` closes the element it opens.
    if (inner !== name || (foreign && !next[1] && next[0].endsWith("/>"))) continue;
    depth += next[1] ? -1 : 1;
    if (depth === 0) return next.index;
  }
  return text.length;
}

/**
 * The destination of an inline link or image whose `(` is at `open`, and the index just past its
 * `)`, or undefined when what follows is not a well-formed destination: `<…>`, or a run without spaces whose parentheses balance at any
 * depth, then only an optional quoted or parenthesised title, which cannot hold a blank line,
 * before `)`.
 */
function inlineDestination(
  text: string,
  open: number,
): { destination: string; end: number } | undefined {
  // Spaces and at most one line ending may stand between the parts, never a blank line.
  const gap = /[ \t]*(?:\n[ \t]*)?/y;
  gap.lastIndex = open + 1;
  gap.exec(text);
  let at = gap.lastIndex;
  let destination: string;
  if (text[at] === "<") {
    // Up to the first unescaped `>`, with no line ending or unescaped `<` inside.
    const bracketed = /<((?:\\.|[^<>\\\n])*)>/y;
    bracketed.lastIndex = at;
    const match = bracketed.exec(text);
    if (!match) return undefined;
    destination = match[1] ?? "";
    at = bracketed.lastIndex;
  } else {
    const from = at;
    let depth = 0;
    for (; at < text.length; at++) {
      const char = text[at] ?? "";
      if (char === "\\") at++;
      else if (/\s/.test(char)) break;
      else if (char === "(") depth++;
      else if (char === ")") {
        if (depth === 0) break;
        depth--;
      }
    }
    if (depth !== 0) return undefined;
    destination = text.slice(from, at);
  }
  const rest =
    /(?:(?:[ \t]+|[ \t]*\n[ \t]*)(?:"(?:\\.|(?!\n[ \t]*\n)[^"\\])*"|'(?:\\.|(?!\n[ \t]*\n)[^'\\])*'|\((?:\\.|(?!\n[ \t]*\n)[^()\\])*\)))?[ \t]*(?:\n[ \t]*)?\)/y;
  rest.lastIndex = at;
  return rest.exec(text)
    ? { destination: unescapeMarkdown(destination), end: rest.lastIndex }
    : undefined;
}

function readText(file: string): string | null {
  try {
    return statSync(file).isFile() ? readFileSync(file, "utf8") : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SVG drawn by an agent.

/** An SVG larger than this is likely to carry embedded pictures rather than a drawing. */
export const MAX_SVG_BYTES = 1_000_000;

/** Elements that run code or embed another document. */
const EMBEDDING_ELEMENTS = new Set(["foreignobject", "iframe", "embed", "object"]);

/** Raster pictures an SVG may inline. A nested SVG could carry its own scripts. */
const INLINE_IMAGE = /^data:image\/(?:png|jpeg|gif|webp)[;,]/i;

/** XML character references, as an XML parser decodes them in an attribute value. */
function decodeXml(value: string): string {
  return value.replace(
    /&(?:#x([0-9a-f]+)|#([0-9]+)|(amp|lt|gt|quot|apos));/gi,
    (whole, hex, dec, name) => {
      if (name)
        return (
          { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[String(name).toLowerCase()] ?? whole
        );
      const code = Number.parseInt(hex ?? dec, hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    },
  );
}

/** CSS with its comments dropped and its escapes read, so `\75 rl(` is seen as `url(`. */
function decodeCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?(?:\*\/|$)/g, "")
    .replace(/\\([0-9a-f]{1,6})[ \t\n\r\f]?/gi, (whole, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    })
    .replace(/\\([^\n])/g, "$1");
}

/** Whether an address keeps to the image: a fragment within it, or an inlined raster picture. */
function staysInside(address: string): boolean {
  const loaded = address.replace(/[\t\n\r]/g, "").trim();
  return loaded === "" || loaded.startsWith("#") || INLINE_IMAGE.test(loaded);
}

/** Whether CSS loads or imports anything from outside the image. */
function cssLeavesImage(css: string): boolean {
  const read = decodeCss(css);
  if (/@import/i.test(read)) return true;
  for (const match of read.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi))
    if (!staysInside(match[1] ?? match[2] ?? match[3] ?? "")) return true;
  return false;
}

/**
 * Check an SVG an agent drew. How it looks is the agent's choice; what is checked is that it is
 * an SVG that scales (a root <svg> with a viewBox), and that opened directly it runs no code and
 * loads or opens nothing outside itself. Markup inside comments and CDATA is text, not markup.
 */
export function checkSvg(svg: string, bytes: number): Violation[] {
  if (bytes > MAX_SVG_BYTES)
    return [
      {
        code: "svg-too-large",
        message: `SVG が大きすぎます（${MAX_SVG_BYTES} バイトまで）。埋め込んだ画像を減らすか、図を分けてください。`,
      },
    ];
  const violations: Violation[] = [];
  const add = (code: string, message: string) => {
    if (!violations.some((violation) => violation.code === code))
      violations.push({ code, message });
  };
  const text = svg.replace(/^﻿/, "").replace(/<!--[\s\S]*?(?:-->|$)/g, "");
  if (/<!(?:DOCTYPE|ENTITY)/i.test(text))
    add(
      "svg-doctype",
      "SVG に DOCTYPE や ENTITY を書かないでください（実体の定義で中身を変えられるため）。",
    );
  const root =
    /^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!DOCTYPE[^[>]*(?:\[[\s\S]*?\])?\s*>\s*)?<([A-Za-z_][\w.:-]*)/.exec(
      text,
    );
  if (!root || (root[1] ?? "").split(":").pop()?.toLowerCase() !== "svg") {
    add("not-svg", "SVG の図ではありません。ルート要素を <svg> にしてください。");
    return violations;
  }
  const external = () =>
    add(
      "svg-external-reference",
      "SVG が外部のファイルや URL を参照しています。図の中の要素（#id）か、埋め込んだラスター画像（data:image/png など）だけを参照してください。",
    );
  let first = true;
  let styleFrom = -1;
  for (const token of text.matchAll(
    /<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<(\/?)([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
  )) {
    const name = token[2];
    if (name === undefined) continue; // CDATA is text; a style sheet reads it below.
    const local = name.split(":").pop()?.toLowerCase() ?? "";
    const index = token.index ?? 0;
    if (token[1]) {
      if (local === "style" && styleFrom >= 0) {
        const sheet = text.slice(styleFrom, index).replace(/<!\[CDATA\[|\]\]>/g, "");
        if (cssLeavesImage(sheet)) external();
        styleFrom = -1;
      }
      continue;
    }
    const attributes = token[3] ?? "";
    const selfClosing = attributes.trimEnd().endsWith("/");
    if (local === "script") add("svg-script", "SVG に <script> を書かないでください。");
    if (EMBEDDING_ELEMENTS.has(local))
      add(
        "svg-embedded-content",
        `SVG に <${name}> を書かないでください（HTML やほかの文書を埋め込めるため）。`,
      );
    if (local === "style" && !selfClosing) styleFrom = index + token[0].length;
    let viewBox = false;
    for (const attribute of attributes.matchAll(
      /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
    )) {
      const attributeName = attribute[1] ?? "";
      const value = decodeXml(attribute[2] ?? attribute[3] ?? attribute[4] ?? "");
      const attributeLocal = attributeName.split(":").pop()?.toLowerCase() ?? "";
      if (attributeName === "viewBox") viewBox = true;
      if (/^on/i.test(attributeLocal))
        add("svg-event-handler", `SVG にイベントの属性（${attributeName}）を書かないでください。`);
      if (attributeLocal === "href" || attributeLocal === "src") {
        if (!staysInside(value)) external();
      } else if (attributeLocal === "style" || /url\(/i.test(value)) {
        if (cssLeavesImage(value)) external();
      } else if (/^\s*javascript:/i.test(value)) external();
    }
    if (first && !viewBox)
      add(
        "svg-no-viewbox",
        "ルートの <svg> に viewBox を書いてください（表示する幅に合わせて縮められるように）。",
      );
    first = false;
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Mermaid.

/** The diagrams Mermaid draws, by the word its first statement starts with. */
const MERMAID_KINDS = new Set([
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "journey",
  "gantt",
  "pie",
  "quadrantChart",
  "requirementDiagram",
  "gitGraph",
  "C4Context",
  "C4Container",
  "C4Component",
  "C4Dynamic",
  "C4Deployment",
  "mindmap",
  "timeline",
  "zenuml",
  "sankey-beta",
  "xychart-beta",
  "block-beta",
  "packet-beta",
  "architecture-beta",
  "kanban",
  "radar-beta",
  "treemap-beta",
]);

export type MermaidBlock = { kind: string | null; uncertain: boolean };

/** The kind of diagram a Mermaid block draws, past its comments and front matter. */
function mermaidKind(body: string[]): string | null {
  let at = 0;
  const skipBlank = () => {
    while (at < body.length && /^\s*(?:%%.*)?$/.test(body[at] ?? "")) at++;
  };
  skipBlank();
  if (/^\s*---\s*$/.test(body[at] ?? "")) {
    at++;
    while (at < body.length && !/^\s*---\s*$/.test(body[at] ?? "")) at++;
    at++;
    skipBlank();
  }
  const word = /^\s*([A-Za-z][\w-]*)/.exec(body[at] ?? "")?.[1];
  return word !== undefined && MERMAID_KINDS.has(word) ? word : null;
}

/**
 * Mermaid blocks a reader may see drawn: fenced code whose info string is `mermaid`, read with the
 * same block structure as the images (blockquotes, list items, HTML blocks and indented code).
 * One the reader may not see (a style sheet in the page, an open comment before it, a hidden
 * element around it) is returned with `uncertain`.
 */
export function findMermaidBlocks(markdown: string): MermaidBlock[] {
  const lines = expandIndentTabs(markdown.replace(/\r\n?/g, "\n")).split("\n");
  const blocks = blockLines(lines);
  const { hidden } = scanImageRefs(markdown);
  const found: MermaidBlock[] = [];
  let fence: {
    mark: string;
    length: number;
    mermaid: boolean;
    start: number;
    body: string[];
  } | null = null;
  const finish = () => {
    if (fence?.mermaid)
      found.push({ kind: mermaidKind(fence.body), uncertain: hidden(fence.start) });
    fence = null;
  };
  lines.forEach((_, number) => {
    const block = blocks[number];
    if (!block?.code) {
      finish();
      return;
    }
    if (fence === null) {
      const open = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/.exec(block.body);
      if (!open) return;
      const mark = open[1] ?? "```";
      fence = {
        mark: mark[0] ?? "`",
        length: mark.length,
        mermaid: (open[2] ?? "").toLowerCase() === "mermaid",
        start: number,
        body: [],
      };
      return;
    }
    const closing = new RegExp(`^ {0,3}\\${fence.mark}{${fence.length},}[ \\t]*$`);
    if (closing.test(block.body)) finish();
    else fence.body.push(block.body);
  });
  finish();
  return found;
}

// ---------------------------------------------------------------------------
// Documents.

/** Check that a Markdown document's diagrams are local and safe, and count them. */
export function checkMarkdown(file: string, options: { minDiagrams: number }): CheckReport {
  const markdown = readText(file);
  if (markdown === null)
    return {
      pass: false,
      diagrams: 0,
      violations: [{ code: "unreadable", message: `文書を読めません: ${file}`, target: file }],
    };
  const base = path.dirname(path.resolve(file));
  // A path relative to the folder leaves it through a `..` segment, not a name such as `..d.svg`.
  const outside = (relative: string) =>
    relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
  // A link may lead out of the folder while its own path stays inside, so where it leads is
  // contained too: a clone of the record would not have what it leads to.
  const realBase = realpathSync(base);
  // A file that is not there leads nowhere; the check reports it as missing.
  const leadsOut = (target: string) => {
    let real: string;
    try {
      real = realpathSync(target);
    } catch {
      return false;
    }
    return outside(path.relative(realBase, real));
  };
  const violations: Violation[] = [];
  let diagrams = 0;
  for (const ref of findImageRefs(markdown)) {
    const target = ref.path;
    if (ref.base) {
      violations.push({
        code: "base-element",
        message: "<base> は画像などの読み込み先を変えるため使えません。",
        target,
      });
      continue;
    }
    // A named reference the check cannot decode (`&bsol;`) may stand for any character, `\` or
    // `/` included, so the file it names is unknown; in CSS or a srcdoc, it may change the page.
    if (ref.unknownReference || /&[a-z][a-z0-9]*;/i.test(target)) {
      violations.push({
        code: "unknown-reference",
        message:
          "画像のパスや style・srcdoc に、確かめられない文字参照（&名前;）があります。文字のまま書いてください。",
        target,
      });
      continue;
    }
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) {
      violations.push({
        code: "external-image",
        message: "外部の画像は使えません。文書と同じフォルダーに SVG を置いて参照してください。",
        target,
      });
      continue;
    }
    if (path.isAbsolute(target) || target.startsWith("/") || /^[A-Za-z]:[\\/]/.test(target)) {
      violations.push({
        code: "absolute-path",
        message: "画像は文書からの相対パスで参照してください。",
        target,
      });
      continue;
    }
    let decoded: string;
    try {
      // A browser loads the file without the fragment or query that follows its name.
      decoded = decodeURIComponent(target.replace(/[?#][\s\S]*$/, ""));
    } catch {
      violations.push({
        code: "invalid-path",
        message: "画像のパスを読めません。% は %25 と書いてください。",
        target,
      });
      continue;
    }
    // A browser reads `\` in an HTML address as `/`, while Markdown renderers send it as `%5C`.
    if (decoded.includes("\\")) {
      violations.push({
        code: "backslash-path",
        message:
          "画像のパスの区切りには / を使ってください（\\ は表示する環境によって読み方が変わります）。",
        target,
      });
      continue;
    }
    const resolved = path.resolve(base, decoded);
    if (outside(path.relative(base, resolved)) || leadsOut(resolved)) {
      violations.push({
        code: "outside-path",
        message: "画像は文書と同じフォルダーの中に置いてください。",
        target,
      });
      continue;
    }
    let size: number;
    try {
      const stat = statSync(resolved);
      if (!stat.isFile()) throw new Error("not a file");
      size = stat.size;
    } catch {
      violations.push({ code: "missing-image", message: "画像のファイルがありません。", target });
      continue;
    }
    // Other pictures (a screenshot) only have to be there; they do not count as diagrams.
    if (path.extname(resolved).toLowerCase() !== ".svg") continue;
    const image = size > MAX_SVG_BYTES ? "" : (readText(resolved) ?? "");
    const problems = checkSvg(image, size);
    for (const problem of problems) violations.push({ ...problem, target });
    // An image the reader may not see as an image is checked but never counted.
    if (problems.length === 0 && !ref.uncertain) diagrams++;
  }
  for (const block of findMermaidBlocks(markdown)) {
    if (block.kind === null) {
      violations.push({
        code: "unknown-mermaid",
        message:
          "Mermaid のブロックの最初の文が、図の種類（flowchart・sequenceDiagram など）で始まっていません。",
      });
      continue;
    }
    if (!block.uncertain) diagrams++;
  }
  if (diagrams < options.minDiagrams)
    violations.push({
      code: "no-diagram",
      message: `図解が必要です（${options.minDiagrams} 件以上）。SVG を描いて本文に埋め込むか、Mermaid のブロックで図を書いてください。コードや HTML ブロック、閉じた <details> の中（<summary> を除く）、4 文字以上字下げした行の図と、<style> のある文書の図は数えません。`,
    });
  return { pass: violations.length === 0, diagrams, violations };
}

// ---------------------------------------------------------------------------
// Sensor.

/** Artifacts a person reviews; each must explain itself with a diagram. */
export const DIAGRAM_REQUIRED = new Set([
  "requirements",
  "components",
  "unit-of-work",
  "bolt-plan",
  "focus-test-report",
  "focus-implement-questions",
  "focus-implementation-report",
]);
export const SCOPE = "focus-flow";

function stateScope(stateFile: string): string | null {
  const text = readText(stateFile);
  return text ? (/^\s*-\s+\*\*Scope\*\*:\s*(\S+)/m.exec(text)?.[1] ?? null) : null;
}

/** Find the workflow scope that owns a document, from its record or the active intent. */
export function findScope(file: string): string | null {
  let dir = path.dirname(path.resolve(file));
  for (;;) {
    const state = path.join(dir, "aidlc-state.md");
    if (existsSync(state)) return stateScope(state);
    const cursor = readText(path.join(dir, "intents", "active-intent"))?.trim();
    if (cursor && /^[^/\\]+$/.test(cursor))
      return stateScope(path.join(dir, "intents", cursor, "aidlc-state.md"));
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

type CliIo = { stdout: (text: string) => void; stderr: (text: string) => void; cwd: string };
const USAGE = [
  "使い方（センサーとして、エンジンが実行する）:",
  "  aidlc-sensor-focus-diagrams.ts --stage <slug> --output-path <document.md>",
  "",
].join("\n");

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

/** Answer the engine's sensor contract: one JSON verdict on stdout, exit code 0. */
export async function runCli(input: string[], io: CliIo): Promise<number> {
  // The engine's sensor dispatcher runs the script with only its fire flags.
  const argv = input[0]?.startsWith("--") ? ["sensor", ...input] : input;
  if (argv[0] !== "sensor") {
    io.stderr(USAGE);
    return 2;
  }
  const output = option(argv, "--output-path");
  if (!output) {
    io.stdout(
      `${JSON.stringify({ pass: false, violations: [{ code: "usage", message: "--output-path がありません。" }] })}\n`,
    );
    return 0;
  }
  const file = path.resolve(io.cwd, output);
  if (path.extname(file).toLowerCase() !== ".md" || findScope(file) !== SCOPE) {
    io.stdout(`${JSON.stringify({ pass: true, diagrams: 0, violations: [], note: "対象外" })}\n`);
    return 0;
  }
  const artifact = path.basename(file, ".md");
  const report = checkMarkdown(file, { minDiagrams: DIAGRAM_REQUIRED.has(artifact) ? 1 : 0 });
  io.stdout(`${JSON.stringify(report)}\n`);
  return 0;
}
