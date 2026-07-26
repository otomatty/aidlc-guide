import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownSurface, PLAIN_PREVIEW_LIMIT } from "../src/viewer/MarkdownSurface.tsx";

/**
 * ADR-05 / team.md: every assertion here is against the **Props contract**
 * (`{markdown, editable, onEdit}`) and the DOM it must produce. Nothing pokes
 * at the renderer's internals, so swapping the renderer behind the contract
 * leaves this file untouched.
 */

vi.mock("../src/viewer/MermaidBlock.tsx", () => ({
  MermaidBlock: ({ code }: { code: string }): ReactNode => (
    <div data-testid="mermaid-stub">{code}</div>
  ),
}));

const SAMPLE = [
  "# 見出し1",
  "",
  "## 見出し2",
  "",
  "| 列A | 列B |",
  "|-----|-----|",
  "| a1  | b1  |",
  "| a2  | b2  |",
  "",
  "- 親",
  "  - 子",
  "    - 孫",
  "1. 一",
  "2. 二",
  "",
  "```ts",
  "const x: number = 1;",
  "```",
  "",
  "```mermaid",
  "graph TD",
  "  A --> B",
  "```",
  "",
  "`inline` と **強調** と [リンク](https://example.com)。",
  "",
  "<!-- cid:hidden-marker -->",
].join("\n");

function renderSurface(markdown: string): void {
  render(<MarkdownSurface markdown={markdown} editable={null} />);
}

describe("MarkdownSurface — the FR-6.1 five-point checklist, as a test", () => {
  it("keeps a GFM table a table, with its rows and columns", () => {
    renderSurface(SAMPLE);
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((c) => c.textContent),
    ).toEqual(["列A", "列B"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3); // header + 2 body rows
    expect(within(table).getByText("a2")).toBeDefined();
  });

  it("hands a mermaid fence to MermaidBlock as bare source text", () => {
    renderSurface(SAMPLE);
    expect(screen.getByTestId("mermaid-stub").textContent).toBe("graph TD\n  A --> B");
  });

  it("keeps a non-mermaid fence as highlighted code, not as a diagram", () => {
    renderSurface(SAMPLE);
    const block = screen.getByTestId("code-block");
    expect(block.getAttribute("data-language")).toBe("ts");
    expect(block.querySelector(".hljs-keyword")?.textContent).toBe("const");
    expect(block.textContent).toContain("const x: number = 1;");
    expect(screen.queryByTestId("mermaid-stub")).toBeDefined();
  });

  it("preserves the heading hierarchy and nested list structure", () => {
    renderSurface(SAMPLE);
    // Artifact headings start below the panel's own <h2>.
    expect(screen.getByRole("heading", { name: "見出し1" }).tagName).toBe("H3");
    expect(screen.getByRole("heading", { name: "見出し2" }).tagName).toBe("H4");
    const grandchild = screen.getByText("孫");
    expect(grandchild.closest("li")?.parentElement?.closest("li")).not.toBeNull();
    expect(screen.getByText("一").closest("ol")).not.toBeNull();
  });

  it("carries the source text through without loss", () => {
    renderSurface(SAMPLE);
    const surface = screen.getByTestId("markdown-surface");
    for (const fragment of ["見出し1", "a1", "b2", "孫", "inline", "強調", "リンク"]) {
      expect(surface.textContent, fragment).toContain(fragment);
    }
  });

  it("renders read-only: no editable region, whatever `editable` says", () => {
    render(<MarkdownSurface markdown={SAMPLE} editable={{ answerLines: [3, 9] }} />);
    const surface = screen.getByTestId("markdown-surface");
    expect(surface.getAttribute("data-readonly")).toBe("true");
    expect(surface.getAttribute("data-answer-lines")).toBe("3,9");
    // Read-only is structural: nothing in the rendered tree can take input.
    expect(surface.querySelector("[contenteditable]")).toBeNull();
    expect(surface.querySelector("input, textarea, select")).toBeNull();
  });
});

describe("MarkdownSurface — the security boundary (S-AV-3)", () => {
  it("shows an HTML block as source text and never as an element", () => {
    renderSurface(['<img src="x" onerror="alert(1)">', "", "<b>太字ではない</b>"].join("\n"));
    const surface = screen.getByTestId("markdown-surface");
    expect(surface.querySelector("img")).toBeNull();
    expect(surface.querySelector("b")).toBeNull();
    expect(surface.textContent).toContain("<b>太字ではない</b>");
  });

  it("drops a javascript: link back to plain text", () => {
    renderSurface("[click](javascript:alert(1))");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTestId("markdown-surface").textContent).toContain("click");
  });

  it("keeps an http link, with a safe rel", () => {
    renderSurface("[docs](https://example.com/a)");
    const link = screen.getByRole("link", { name: "docs" });
    expect(link.getAttribute("href")).toBe("https://example.com/a");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("hides an HTML comment rather than printing its marker", () => {
    renderSurface(SAMPLE);
    expect(screen.getByTestId("markdown-surface").textContent).not.toContain("cid:hidden-marker");
  });

  it("highlights a fence without turning fence text into HTML elements", () => {
    renderSurface(["```html", "<img src=x onerror=alert(1)>", "```"].join("\n"));
    const block = screen.getByTestId("code-block");
    expect(block.querySelector("img")).toBeNull();
    expect(block.querySelector("script")).toBeNull();
    expect(block.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(block.querySelector("span.hljs-tag, span.hljs-name")).not.toBeNull();
  });
});

describe("MarkdownSurface — the two fallbacks to PlainPreview", () => {
  it("goes straight to plain preview above 1MB, without a rich render (P-AV-5)", () => {
    const huge = `# big\n\n${"あ".repeat(PLAIN_PREVIEW_LIMIT)}`;
    render(<MarkdownSurface markdown={huge} editable={null} />);
    expect(screen.getByTestId("plain-preview")).toBeDefined();
    expect(screen.queryByTestId("markdown-surface")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText(/1MB 超/)).toBeDefined();
  });

  // The run-time-crash fallback (D3 error(b)) needs a throwing renderer and so
  // lives in viewer-surface-crash.test.tsx, where the mock can differ.
});

describe("MarkdownSurface — the rest of the artifact dialect", () => {
  const MORE = [
    "> 引用文",
    "",
    "---",
    "",
    "- [x] 済んだ作業",
    "- [ ] まだの作業",
    "",
    "5. 五番目から",
    "",
    "~~取り消し~~ と ![図の説明](diagram.png)",
    "",
    "###### 見出し6",
  ].join("\n");

  it("renders quotes, rules, task items, list offsets, strike-through and image alt text", () => {
    renderSurface(MORE);
    const surface = screen.getByTestId("markdown-surface");

    expect(surface.querySelector("blockquote")?.textContent).toContain("引用文");
    expect(surface.querySelector("hr")).not.toBeNull();

    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.map((box) => box.checked)).toEqual([true, false]);
    // Read-only: the boxes report state, they do not accept it.
    expect(boxes.every((box) => box.readOnly)).toBe(true);

    expect(surface.querySelector("ol")?.getAttribute("start")).toBe("5");
    expect(surface.querySelector("del")?.textContent).toBe("取り消し");
    // An <img> would be a network fetch driven by document content.
    expect(surface.querySelector("img")).toBeNull();
    expect(surface.textContent).toContain("図の説明");
    // Depth is clamped so the artifact outline never runs past <h6>.
    expect(screen.getByRole("heading", { name: "見出し6" }).tagName).toBe("H6");
  });
});
