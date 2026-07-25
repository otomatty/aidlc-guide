import { lexer, type Token, type Tokens } from "marked";
import { Component, type ErrorInfo, Fragment, type ReactNode } from "react";
import { safeHref } from "../services/docs.ts";
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

function inline(tokens: readonly Token[]): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${token.type}-${index}`;
    switch (token.type) {
      case "strong":
        return <strong key={key}>{inline((token as Tokens.Strong).tokens)}</strong>;
      case "em":
        return <em key={key}>{inline((token as Tokens.Em).tokens)}</em>;
      case "del":
        return <del key={key}>{inline((token as Tokens.Del).tokens)}</del>;
      case "codespan":
        return <code key={key}>{(token as Tokens.Codespan).text}</code>;
      case "br":
        return <br key={key} />;
      case "link": {
        const link = token as Tokens.Link;
        // Same allow-list the header links go through (S-UI-4): an artifact is
        // a document a human wrote, which is not a reason to open `javascript:`.
        const href = safeHref(link.href);
        return href === null ? (
          <Fragment key={key}>{inline(link.tokens)}</Fragment>
        ) : (
          <a key={key} href={href} rel="noopener noreferrer">
            {inline(link.tokens)}
          </a>
        );
      }
      case "image":
        // Rendered as its alt text: artifacts are local Markdown and an <img>
        // would be a network fetch driven by document content.
        return <Fragment key={key}>{(token as Tokens.Image).text}</Fragment>;
      case "text": {
        const text = token as Tokens.Text;
        return text.tokens === undefined ? (
          <Fragment key={key}>{text.text}</Fragment>
        ) : (
          <Fragment key={key}>{inline(text.tokens)}</Fragment>
        );
      }
      default:
        // `html`, `escape` and anything marked adds later: shown as the literal
        // source text. Never parsed, never injected.
        return <Fragment key={key}>{token.raw}</Fragment>;
    }
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
      {blocks(item.tokens)}
    </li>
  ));
  return list.ordered ? (
    <ol start={list.start === "" ? undefined : list.start}>{items}</ol>
  ) : (
    <ul>{items}</ul>
  );
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

function block(token: Token, key: string): ReactNode {
  switch (token.type) {
    case "space":
      return null;
    case "heading":
      return <Heading key={key} heading={token as Tokens.Heading} />;
    case "code": {
      const code = token as Tokens.Code;
      // FR-6.3: the fence detection lives here, and all MermaidBlock ever
      // receives is the fence body — the glue survives a renderer swap.
      if (code.lang?.trim().toLowerCase() === "mermaid") {
        return <MermaidBlock key={key} code={code.text} />;
      }
      return (
        <pre key={key} className="viewer__raw">
          <code>{code.text}</code>
        </pre>
      );
    }
    case "table":
      return <Table key={key} table={token as Tokens.Table} />;
    case "list":
      return <List key={key} list={token as Tokens.List} />;
    case "blockquote":
      return <blockquote key={key}>{blocks((token as Tokens.Blockquote).tokens)}</blockquote>;
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
      return <p key={key}>{inline((token as Tokens.Paragraph).tokens)}</p>;
    default:
      return <p key={key}>{token.raw}</p>;
  }
}

function blocks(tokens: readonly Token[]): ReactNode[] {
  return tokens.map((token, index) => block(token, `${token.type}-${index}`));
}

function Rendered({ markdown }: { markdown: string }): ReactNode {
  return <>{blocks(lexer(markdown))}</>;
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

export function MarkdownSurface({ markdown, editable }: MarkdownSurfaceProps): ReactNode {
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
