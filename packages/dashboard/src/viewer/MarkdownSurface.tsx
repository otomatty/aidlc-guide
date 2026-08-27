import { lexer, type MarkedToken, type Token, type Tokens } from "marked";
import { Component, type ErrorInfo, Fragment, memo, type ReactNode, useMemo } from "react";
import { canOpenDocsInIde, openFileInIde, safeHref } from "../services/docs.ts";
import { CodeBlock } from "./CodeBlock.tsx";
import { parseFileRef } from "./file-ref.ts";
import { MermaidBlock } from "./MermaidBlock.tsx";
import { PlainPreview } from "./PlainPreview.tsx";

/**
 * **The data-contract boundary of ADR-05.** Everything outside this file sees
 * only `{ markdown, editable, onEdit }`; which renderer sits behind it is not
 * observable from the props, and swapping it touches this file alone.
 *
 * The renderer currently behind the contract is a token→React mapping over
 * `marked`'s lexer — see code-summary.md D-1 for the measured evidence that
 * rejected Milkdown/Crepe. `marked.parse()` (which produces an HTML string) is
 * **never** called: only `lexer()`, whose output is turned into React elements.
 * That is what makes S-AV-3 structural rather than a review rule — there is no
 * HTML string anywhere on this path to inject.
 */

/** business-logic-model.md データ契約. */
export interface EditableSpec {
  /** 1-based line numbers of the `[Answer]:` lines in this artifact. */
  answerLines: number[];
}

export interface MarkdownSurfaceProps {
  markdown: string;
  editable: EditableSpec | null;
  /**
   * The commit half of the contract. The read-only renderer never calls it —
   * `AnswerEditor` owns editing (frontend-components.md hierarchy) — but it
   * stays on the boundary so a future editable renderer has one seam to use
   * and no other file changes. See code-summary.md D-3.
   */
  onEdit?: (line: number, value: string) => void;
}

/**
 * P-AV-5: above this, no rich render is even attempted. Measured in UTF-16
 * code units, which under-counts UTF-8 bytes for CJK — i.e. it trips *earlier*
 * than a byte threshold would, which is the safe direction for a cost guard.
 */
export const PLAIN_PREVIEW_LIMIT = 1_000_000;

const HTML_COMMENT = /^\s*<!--[\s\S]*-->\s*$/;

/* ------------------------------ inline ------------------------------ */

/**
 * FR-6.1 addendum: a code span that names a file becomes a jump to that file.
 * The detection is `parseFileRef`'s (a leaf module, so it is testable on its
 * own); what stays here is the glue, the same way the mermaid *fence detection*
 * stays here — a renderer swap replaces this file and keeps both rules.
 *
 * Rendered as a `<button>`, not an `<a>`: there is no URL involved. The href
 * that would carry a workspace path is exactly the `file:` scheme `safeHref`
 * refuses (S-UI-4), and the host resolves the path anyway.
 *
 * `plain` is set for a span inside a link — ``[`packages/foo.ts`](docs/foo)``.
 * A button inside an anchor is invalid nested interactive content, and clicking
 * it would both post `open-file` *and* follow the anchor, navigating the webview
 * away. The link is the author's own destination and it wins.
 */
function CodeSpan({ text, plain }: { text: string; plain: boolean }): ReactNode {
  const ref = plain ? null : parseFileRef(text);
  // Only the IDE host can focus a line in an editor. Over the browser transport
  // (Mob mode) the span stays plain rather than offering a jump nothing can do.
  if (ref === null || !canOpenDocsInIde()) return <code>{text}</code>;
  return (
    <code>
      <button
        type="button"
        className="viewer__file-ref"
        title={`エディタで開く: ${text}`}
        onClick={() => {
          openFileInIde(ref);
        }}
      >
        {text}
      </button>
    </code>
  );
}

/**
 * `Token` is `MarkedToken | Generic`. Generic is open (`type: string`), so a
 * switch on `Token` can never be exhaustive. Narrow first; unknown extensions
 * must not dump `raw` (that re-leaks markdown source).
 */
function isMarkedToken(token: Token): token is MarkedToken {
  switch (token.type) {
    case "blockquote":
    case "br":
    case "code":
    case "codespan":
    case "def":
    case "del":
    case "em":
    case "escape":
    case "heading":
    case "hr":
    case "html":
    case "image":
    case "link":
    case "list":
    case "list_item":
    case "paragraph":
    case "space":
    case "strong":
    case "table":
    case "text":
      return true;
    default:
      return false;
  }
}

function genericFallback(token: Token, key: string): ReactNode {
  const text = "text" in token && typeof token.text === "string" ? token.text : null;
  return text === null ? null : <Fragment key={key}>{text}</Fragment>;
}

/** `inLink` rides down the recursion so a code span knows an anchor encloses it. */
function inlineMarked(token: MarkedToken, key: string, inLink: boolean): ReactNode {
  switch (token.type) {
    case "strong":
      return <strong key={key}>{inline(token.tokens, inLink)}</strong>;
    case "em":
      return <em key={key}>{inline(token.tokens, inLink)}</em>;
    case "del":
      return <del key={key}>{inline(token.tokens, inLink)}</del>;
    case "codespan":
      return <CodeSpan key={key} text={token.text} plain={inLink} />;
    case "br":
      return <br key={key} />;
    case "link": {
      // Same allow-list the header links go through (S-UI-4): an artifact is
      // a document a human wrote, which is not a reason to open `javascript:`.
      const href = safeHref(token.href);
      // A refused href renders no anchor, so a code span inside it is not
      // enclosed by anything and may still be a jump.
      return href === null ? (
        <Fragment key={key}>{inline(token.tokens, inLink)}</Fragment>
      ) : (
        <a key={key} href={href} rel="noopener noreferrer">
          {inline(token.tokens, true)}
        </a>
      );
    }
    case "image":
      // Rendered as its alt text: artifacts are local Markdown and an <img>
      // would be a network fetch driven by document content.
      return <Fragment key={key}>{token.text}</Fragment>;
    case "text":
      return token.tokens === undefined ? (
        <Fragment key={key}>{token.text}</Fragment>
      ) : (
        <Fragment key={key}>{inline(token.tokens, inLink)}</Fragment>
      );
    case "escape":
      return <Fragment key={key}>{token.text}</Fragment>;
    case "html":
      // Inline HTML is source text, never parsed (S-AV-3). Block HTML is
      // handled in `blockMarked`.
      return <Fragment key={key}>{token.raw}</Fragment>;
    case "space":
    case "heading":
    case "code":
    case "table":
    case "list":
    case "list_item":
    case "blockquote":
    case "hr":
    case "paragraph":
    case "def":
      return null;
    default: {
      const _exhaustive: never = token;
      return _exhaustive;
    }
  }
}

function inline(tokens: readonly Token[], inLink = false): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${token.type}-${index}`;
    return isMarkedToken(token) ? inlineMarked(token, key, inLink) : genericFallback(token, key);
  });
}

/* ------------------------------- blocks ------------------------------ */

function Table({ table }: { table: Tokens.Table }): ReactNode {
  return (
    <div className="viewer__table-scroll">
      <table className="viewer__table">
        <thead>
          <tr>
            {table.header.map((cell, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: column position is the identity
              <th key={index} scope="col" style={{ textAlign: cell.align ?? undefined }}>
                {inline(cell.tokens)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: row position is the identity
            <tr key={rowIndex}>
              {row.map((cell, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: column position is the identity
                <td key={index} style={{ textAlign: cell.align ?? undefined }}>
                  {inline(cell.tokens)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function List({ list }: { list: Tokens.List }): ReactNode {
  const items = list.items.map((item, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: list position is the identity
    <li key={index}>
      {item.task ? <input type="checkbox" checked={item.checked === true} readOnly /> : null}
      {item.loose ? looseItemBlocks(item.tokens) : blocks(item.tokens)}
    </li>
  ));
  return list.ordered ? (
    <ol start={list.start === "" ? undefined : list.start}>{items}</ol>
  ) : (
    <ul>{items}</ul>
  );
}

/** CommonMark loose items wrap `text` in <p>; tight items do not. */
function looseItemBlocks(tokens: readonly Token[]): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${token.type}-${index}`;
    if (isMarkedToken(token) && token.type === "text") {
      return <p key={key}>{token.tokens === undefined ? token.text : inline(token.tokens)}</p>;
    }
    return block(token, key);
  });
}

function Heading({ heading }: { heading: Tokens.Heading }): ReactNode {
  const children = inline(heading.tokens);
  // The panel already owns <h2>; artifact headings start one level below so the
  // document outline stays monotonic (a11y checklist 1.3.1).
  switch (Math.min(heading.depth, 4)) {
    case 1:
      return <h3>{children}</h3>;
    case 2:
      return <h4>{children}</h4>;
    case 3:
      return <h5>{children}</h5>;
    default:
      return <h6>{children}</h6>;
  }
}

function blockMarked(token: MarkedToken, key: string): ReactNode {
  switch (token.type) {
    case "space":
      return null;
    case "heading":
      return <Heading key={key} heading={token} />;
    case "code": {
      // FR-6.3: the fence detection lives here, and all MermaidBlock ever
      // receives is the fence body — the glue survives a renderer swap.
      if (token.lang?.trim().toLowerCase() === "mermaid") {
        return <MermaidBlock key={key} code={token.text} />;
      }
      return <CodeBlock key={key} code={token.text} lang={token.lang} />;
    }
    case "table":
      return <Table key={key} table={token} />;
    case "list":
      return <List key={key} list={token} />;
    case "blockquote":
      return <blockquote key={key}>{blocks(token.tokens)}</blockquote>;
    case "hr":
      return <hr key={key} />;
    case "html":
      // Comments carry machine markers (`<!-- cid:… -->`) and are noise on
      // screen; any other HTML is shown as source, never parsed.
      return HTML_COMMENT.test(token.raw) ? null : (
        <pre key={key} className="viewer__raw">
          <code>{token.raw}</code>
        </pre>
      );
    case "paragraph":
      return <p key={key}>{inline(token.tokens)}</p>;
    case "text":
      // Tight list items are CommonMark `text`, not `paragraph`. Walk the
      // already-lexed inline tokens; do not wrap in <p> (that is loose-list).
      return (
        <Fragment key={key}>
          {token.tokens === undefined ? token.text : inline(token.tokens)}
        </Fragment>
      );
    case "def":
      return null;
    case "list_item":
      return <Fragment key={key}>{blocks(token.tokens)}</Fragment>;
    case "strong":
    case "em":
    case "del":
    case "codespan":
    case "br":
    case "link":
    case "image":
    case "escape":
      return <Fragment key={key}>{inlineMarked(token, key, false)}</Fragment>;
    default: {
      const _exhaustive: never = token;
      return _exhaustive;
    }
  }
}

function block(token: Token, key: string): ReactNode {
  return isMarkedToken(token) ? blockMarked(token, key) : genericFallback(token, key);
}

function blocks(tokens: readonly Token[]): ReactNode[] {
  return tokens.map((token, index) => block(token, `${token.type}-${index}`));
}

function Rendered({ markdown }: { markdown: string }): ReactNode {
  // Re-lexing a full document (up to PLAIN_PREVIEW_LIMIT) on unrelated store
  // dispatches is the dashboard's single biggest render cost — memoise on the
  // text itself (≤2s change-reflect budget, NFR-3).
  const tree = useMemo(() => blocks(lexer(markdown)), [markdown]);
  return <>{tree}</>;
}

/* ---------------------------- the boundary --------------------------- */

interface BoundaryState {
  crashed: boolean;
}

/**
 * D3 error(b): a renderer that throws on some artifact must degrade to plain
 * text, not take the panel down. The caller never learns it happened — the
 * props contract is unchanged either way.
 */
class RenderBoundary extends Component<{ markdown: string; children: ReactNode }, BoundaryState> {
  state: BoundaryState = { crashed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { crashed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("[markdown-surface]", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.crashed) {
      return (
        <PlainPreview
          markdown={this.props.markdown}
          note="リッチ表示できないため素のテキストで表示しています"
        />
      );
    }
    return this.props.children;
  }
}

function MarkdownSurfaceImpl({ markdown, editable }: MarkdownSurfaceProps): ReactNode {
  if (markdown.length > PLAIN_PREVIEW_LIMIT) {
    return (
      <PlainPreview
        markdown={markdown}
        note="サイズが大きいため素のテキストで表示しています（1MB 超）"
      />
    );
  }

  return (
    <div
      className="viewer__surface"
      data-testid="markdown-surface"
      // Static content: read-only-ness is structural (no contenteditable, no
      // form control anywhere in the rendered tree) rather than announced.
      // `aria-readonly` is not a supported attribute on a generic region and
      // Biome's a11y rule rightly rejects it — see code-summary.md D-4. The
      // `[Answer]:` lines are edited through AnswerEditor's labelled fields.
      data-readonly="true"
      data-answer-lines={editable === null ? undefined : editable.answerLines.join(",")}
    >
      <RenderBoundary markdown={markdown}>
        <Rendered markdown={markdown} />
      </RenderBoundary>
    </div>
  );
}

/**
 * `memo` holds only if callers keep `editable` referentially stable for the
 * same answer-line set — the viewer memoises it (see viewer/index.tsx).
 */
export const MarkdownSurface = memo(MarkdownSurfaceImpl);
