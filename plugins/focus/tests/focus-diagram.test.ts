import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkMarkdown,
  checkSvg,
  findImageRefs,
  findMermaidBlocks,
  MAX_SVG_BYTES,
  runCli,
} from "../tools/focus-diagram.ts";

type Io = { out: string[]; err: string[] };
function io(cwd: string): Io & {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  cwd: string;
} {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    cwd,
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
  };
}

/** A diagram an agent might draw: its own shapes, text and styles, nothing loaded from outside. */
const drawn = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 240" role="img">',
  "  <title>会員検索の構成</title>",
  "  <style>.box{fill:#fff;stroke:#0f172a}.label{font:14px sans-serif}</style>",
  '  <defs><linearGradient id="g"><stop offset="0" stop-color="#e2e8f0"/></linearGradient></defs>',
  '  <rect class="box" x="10" y="10" width="200" height="60" fill="url(#g)"/>',
  '  <text class="label" x="20" y="45">API Gateway</text>',
  '  <use href="#icon"/>',
  '  <image href="data:image/png;base64,iVBORw0KGgo=" x="0" y="0" width="16" height="16"/>',
  "</svg>",
  "",
].join("\n");

function svgCodes(text: string): string[] {
  return checkSvg(text, Buffer.byteLength(text)).map((v) => v.code);
}

describe("checkSvg", () => {
  it("accepts a freely drawn diagram that loads nothing from outside", () => {
    expect(svgCodes(drawn)).toEqual([]);
    // An XML declaration, a comment and a byte order mark may come before the root.
    expect(svgCodes(`﻿<?xml version="1.0"?>\n<!-- 図 -->\n${drawn}`)).toEqual([]);
  });

  it("requires an svg root with a viewBox, so the image can scale to the page", () => {
    expect(svgCodes("<html><body>x</body></html>")).toEqual(["not-svg"]);
    expect(svgCodes("")).toEqual(["not-svg"]);
    expect(svgCodes('<svg xmlns="http://www.w3.org/2000/svg" width="10"/>')).toEqual([
      "svg-no-viewbox",
    ]);
    // XML names are case-sensitive: viewbox is not viewBox.
    expect(svgCodes('<svg viewbox="0 0 1 1"/>')).toEqual(["svg-no-viewbox"]);
  });

  it("rejects a document type, which can define entities", () => {
    expect(
      svgCodes('<!DOCTYPE svg [<!ENTITY x "y">]>\n<svg viewBox="0 0 1 1"><text>&x;</text></svg>'),
    ).toEqual(["svg-doctype"]);
  });

  it("rejects scripts, event handlers and embedded documents", () => {
    expect(svgCodes('<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>')).toEqual([
      "svg-script",
    ]);
    expect(svgCodes('<svg viewBox="0 0 1 1"><svg:script/></svg>')).toEqual(["svg-script"]);
    expect(svgCodes('<svg viewBox="0 0 1 1" onload="alert(1)"><rect/></svg>')).toEqual([
      "svg-event-handler",
    ]);
    expect(svgCodes(`<svg viewBox="0 0 1 1"><rect ONCLICK='x()'/></svg>`)).toEqual([
      "svg-event-handler",
    ]);
    expect(
      svgCodes('<svg viewBox="0 0 1 1"><foreignObject><p>x</p></foreignObject></svg>'),
    ).toEqual(["svg-embedded-content"]);
    expect(svgCodes('<svg viewBox="0 0 1 1"><iframe src="#a"/></svg>')).toEqual([
      "svg-embedded-content",
    ]);
  });

  it("rejects references that load or open something outside the image", () => {
    const codes = (body: string) => svgCodes(`<svg viewBox="0 0 1 1">${body}</svg>`);
    expect(codes('<image href="https://example.com/icon.png"/>')).toEqual([
      "svg-external-reference",
    ]);
    expect(codes('<use xlink:href="icons.svg#a"/>')).toEqual(["svg-external-reference"]);
    expect(codes('<a href="javascript:alert(1)"><text>x</text></a>')).toEqual([
      "svg-external-reference",
    ]);
    // A nested SVG could carry its own scripts, so only raster images may be inlined.
    expect(codes('<image href="data:image/svg+xml;base64,PHN2Zy8+"/>')).toEqual([
      "svg-external-reference",
    ]);
    expect(codes('<rect fill="url(https://example.com/p.svg#g)"/>')).toEqual([
      "svg-external-reference",
    ]);
    expect(codes("<style>@import url(theme.css);</style>")).toEqual(["svg-external-reference"]);
    expect(codes("<style>.a{background:url('https://example.com/a.png')}</style>")).toEqual([
      "svg-external-reference",
    ]);
    expect(codes('<rect style="fill:url(other.svg#g)"/>')).toEqual(["svg-external-reference"]);
  });

  it("reads references as the browser decodes them", () => {
    const codes = (body: string) => svgCodes(`<svg viewBox="0 0 1 1">${body}</svg>`);
    // &#106; is j: the browser follows javascript:.
    expect(codes('<a href="&#106;avascript:alert(1)"><text>x</text></a>')).toEqual([
      "svg-external-reference",
    ]);
    expect(codes('<image href=" &#x68;ttps://example.com/a.png"/>')).toEqual([
      "svg-external-reference",
    ]);
    // A css escape spells url( and @import as well.
    expect(codes("<style>.a{fill:\\75 rl(https://example.com/a.svg#g)}</style>")).toEqual([
      "svg-external-reference",
    ]);
    expect(codes("<style>@\\69mport 'x.css';</style>")).toEqual(["svg-external-reference"]);
    // CDATA hides nothing from the style sheet.
    expect(codes("<style><![CDATA[.a{fill:url(https://example.com/a.svg#g)}]]></style>")).toEqual([
      "svg-external-reference",
    ]);
  });

  it("ignores markup and references written inside comments or text", () => {
    const text =
      '<svg viewBox="0 0 1 1"><!-- <script>x</script> <image href="https://e.com/a.png"/> -->' +
      "<text>onload= と url(https://example.com) は文字です</text></svg>";
    expect(svgCodes(text)).toEqual([]);
  });

  it("limits the size of an image", () => {
    expect(checkSvg(drawn, MAX_SVG_BYTES + 1).map((v) => v.code)).toEqual(["svg-too-large"]);
  });
});

describe("findMermaidBlocks", () => {
  it("finds mermaid fences and the kind of diagram each one draws", () => {
    const md = [
      "# 設計",
      "",
      "```mermaid",
      "%% 構成",
      "flowchart LR",
      "  A --> B",
      "```",
      "",
      "~~~ mermaid",
      "---",
      "title: 順序",
      "---",
      "sequenceDiagram",
      "  A->>B: 呼ぶ",
      "~~~",
    ].join("\n");
    expect(findMermaidBlocks(md)).toEqual([
      { kind: "flowchart", uncertain: false },
      { kind: "sequenceDiagram", uncertain: false },
    ]);
  });

  it("reports a block whose first statement names no diagram", () => {
    expect(findMermaidBlocks("```mermaid\nA --> B\n```")).toEqual([
      { kind: null, uncertain: false },
    ]);
    expect(findMermaidBlocks("```mermaid\n```")).toEqual([{ kind: null, uncertain: false }]);
  });

  it("does not take a fence inside another fence, a comment or indented code for a diagram", () => {
    const md = [
      "````md",
      "```mermaid",
      "flowchart LR",
      "```",
      "````",
      "",
      "<!--",
      "```mermaid",
      "flowchart LR",
      "```",
      "-->",
      "",
      "    ```mermaid",
      "    flowchart LR",
      "    ```",
      "",
      "```js",
      "const a = 1;",
      "```",
    ].join("\n");
    expect(findMermaidBlocks(md)).toEqual([]);
  });

  it("marks diagrams in a document with a style sheet that may hide them", () => {
    expect(findMermaidBlocks("<style>pre{display:none}</style>\n\n```mermaid\npie\n```")).toEqual([
      { kind: "pie", uncertain: true },
    ]);
  });
});

describe("findImageRefs", () => {
  it("collects markdown and html images but skips code blocks", () => {
    const md = [
      "![全体図](diagrams/overview.svg)",
      '<img src="diagrams/flow.svg" alt="流れ">',
      "```",
      "![例](diagrams/ignored.svg)",
      "```",
      '![題](diagrams/title.svg "タイトル")',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "diagrams/overview.svg",
      "diagrams/flow.svg",
      "diagrams/title.svg",
    ]);
  });

  it("skips every kind of fenced code block, including one left open at the end", () => {
    const md = [
      "~~~md",
      "![チルダ](diagrams/tilde.svg)",
      "~~~",
      "````",
      "```",
      "![入れ子](diagrams/nested.svg)",
      "````",
      "![見える](diagrams/shown.svg)",
      "```",
      "![閉じていない](diagrams/open.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual(["diagrams/shown.svg"]);
  });

  it("reads html image sources with or without quotes", () => {
    const md = "<img src=https://example.com/a.svg>\n<img alt=図 src='diagrams/b.svg'>";
    expect(findImageRefs(md)).toEqual([
      { alt: "", path: "https://example.com/a.svg", uncertain: false },
      { alt: "図", path: "diagrams/b.svg", uncertain: false },
    ]);
  });

  it("skips fenced code inside block quotes and list items", () => {
    const md = [
      "> ~~~",
      "> ![引用の中](diagrams/quoted.svg)",
      "> ~~~",
      "- ```md",
      "  ![項目の中](diagrams/listed.svg)",
      "  ```",
      "",
      "![外部](https://example.com/after-list.png)",
      "> ```",
      "> ![閉じていない引用](diagrams/open-quote.svg)",
      "",
      "![引用の後](diagrams/after-quote.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "https://example.com/after-list.png",
      "diagrams/after-quote.svg",
    ]);
  });

  it("closes an indented fence at a fence on the left edge instead of opening a new one", () => {
    const md = [
      "   ```",
      "   ![コード](diagrams/code.svg)",
      "```",
      "![外部](https://example.com/a.png)",
    ];
    expect(findImageRefs(md.join("\n")).map((ref) => ref.path)).toEqual([
      "https://example.com/a.png",
    ]);
  });

  it("decodes character references and drops tabs and line breaks the way a browser does", () => {
    const md = [
      '<img src="diagrams/local.svg" srcset="https&#58;//example.com/a.svg 2x">',
      '<img src="h&Tab;ttps://example.com/b.svg">',
      "![x](https&#x3A;//example.com/c.svg)",
      "![y](diagrams/a&amp;b.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "diagrams/local.svg",
      "https://example.com/a.svg",
      "https://example.com/b.svg",
      "https://example.com/c.svg",
      "diagrams/a&b.svg",
    ]);
  });

  it("reads a tag to its real end when a quoted attribute contains >", () => {
    const md = `<img alt=">" src="https://example.com/remote.svg">\n<img title='a>b' src=diagrams/c.svg>`;
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "https://example.com/remote.svg",
      "diagrams/c.svg",
    ]);
  });

  it("checks svg image links and css addresses, leaving references within the page alone", () => {
    const md = [
      '<svg><image href="/remote.svg"></image><use xlink:href="#shape" fill="url(#g)"></use></svg>',
      "<div style=\"background:url('diagrams/bg.svg')\">x</div>",
      '<style>body { background: url("/page.svg") } @import "theme.css";</style>',
      '<table><tr><td background="/cell.svg">x</td></tr></table>',
      '<link rel="preload" as="image" imagesrcset="/wide.svg 2x">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["/remote.svg", true],
      ["diagrams/bg.svg", true],
      ["/page.svg", true],
      ["theme.css", true],
      ["/cell.svg", true],
      ["/wide.svg", true],
    ]);
  });

  it("checks every candidate of a resource attribute, counting only an img source", () => {
    const md = [
      '<picture><source srcset="/remote.svg 1x, diagrams/b.svg 2x"><img src="diagrams/local.svg"></picture>',
      "",
      '<picture><img src="diagrams/e.svg"></picture>',
    ].join("\n");
    // A source in the picture may be shown instead of its img, so that img does not count.
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["/remote.svg", true],
      ["diagrams/b.svg", true],
      ["diagrams/local.svg", true],
      ["diagrams/e.svg", false],
    ]);
  });

  it("reads no img written inside script, style or textarea, which loads nothing", () => {
    const md = [
      "<script>",
      "const x = '<img src=\"diagrams/s.svg\">';",
      "</script>",
      '<textarea><img src="diagrams/t.svg"></textarea>',
      "",
      '<img src="diagrams/v.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/v.svg", false],
    ]);
  });

  it("reports any absolute address a visible html element would load", () => {
    const md = [
      '<img src="diagrams/local.svg" srcset="https://example.com/remote.svg 1x, diagrams/b.svg 2x">',
      '<picture><source srcset="https://example.com/a.webp"></picture>',
      '<div style="background:url(//cdn.example.com/bg.png)">x</div>',
      '<a href="https://jira.example.com/browse/PROJ-1">PROJ-1</a>',
      "<https://example.com/autolink>",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "diagrams/local.svg",
      "https://example.com/remote.svg",
      "diagrams/b.svg",
      "https://example.com/a.webp",
      "//cdn.example.com/bg.png",
    ]);
  });

  it("resolves reference labels that hold escaped brackets", () => {
    const md = "![x][a\\]b]\n\n[a\\]b]: https://example.com/x.svg";
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual(["https://example.com/x.svg"]);
  });

  it("reads images whose alt text holds escaped or nested brackets", () => {
    const md = [
      "![a\\]b](https://example.com/x.svg)",
      "![a [b] c](https://example.com/y.svg) と [リンク](https://jira.example.com/browse/P-1)",
      "![a\\]b][r]",
      "",
      "[r]: https://example.com/z.svg",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "https://example.com/x.svg",
      "https://example.com/y.svg",
      "https://example.com/z.svg",
    ]);
  });

  it("reads the address of an image whatever form its title takes", () => {
    const md = [
      '![a](https://example.com/a.svg "題")',
      "![b](https://example.com/b.svg '題')",
      "![c](https://example.com/c.svg (題))",
      "![d](<diagrams/d e.svg>)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "https://example.com/a.svg",
      "https://example.com/b.svg",
      "https://example.com/c.svg",
      "diagrams/d e.svg",
    ]);
  });

  it("reads html attributes the way a browser does, slashes included", () => {
    const md = [
      '<img/src="/remote.svg">',
      '<img alt=a/src=diagrams/fake.svg src="diagrams/real.svg">',
      '<img/hidden/src="diagrams/h.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["/remote.svg", false],
      ["diagrams/real.svg", false],
      ["diagrams/h.svg", true],
    ]);
  });

  it("follows reference images however deeply their alt text nests brackets", () => {
    const md = [
      "![a [b [c [d] e] f] g][remote]",
      "![図][b](後ろの文)",
      "![x](diagrams/x.svg garbage)",
      "",
      "[remote]: https://example.com/x.svg",
      "[b]: diagrams/b.svg",
      "[x]: diagrams/shortcut.svg",
    ].join("\n");
    // `![x](… garbage)` is no inline image, so `![x]` falls back to the shortcut reference.
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/x.svg", false],
      ["diagrams/b.svg", false],
      ["diagrams/shortcut.svg", false],
    ]);
  });

  it("does not count an image written inside another image's alt text", () => {
    const md = "![外 ![内](diagrams/in.svg) 側](diagrams/out.svg)";
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/out.svg", false],
      ["diagrams/in.svg", true],
    ]);
  });

  it("does not count images indented into code inside blockquotes and list items", () => {
    const md = [
      ">     ![隠し](diagrams/d.svg)",
      "",
      "> ![見える](diagrams/e.svg)",
      "",
      "- 項目",
      "    ![続き](diagrams/f.svg)",
      "",
      "-     ![項目の中のコード](diagrams/g.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
      ["diagrams/e.svg", false],
      ["diagrams/f.svg", false],
      ["diagrams/g.svg", true],
    ]);
  });

  it("reads inline destinations with parentheses balanced to any depth", () => {
    const md = [
      "![remote](https://example.com/a((b)).svg)",
      "![崩れ](diagrams/a(b.svg)",
      "![e]()",
      "",
      "[e]: diagrams/e.svg",
    ].join("\n");
    // An unbalanced destination is no image; an empty one is an image that loads nothing.
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/a((b)).svg", false],
    ]);
  });

  it("reads a definition only when nothing but a title follows its address", () => {
    const md = [
      "[x]: diagrams/d.svg garbage",
      "",
      '[y]: diagrams/y.svg "タイトル"',
      "",
      "[z]: diagrams/z.svg",
      '"次の行のタイトル"',
      "",
      "![x] ![y] ![z]",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/y.svg", false],
      ["diagrams/z.svg", false],
    ]);
  });

  it("checks what a link's tag loads, but not where the link goes", () => {
    const md = '<a href="https://example.com/page" style="background-image:url(/remote.svg)">x</a>';
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["/remote.svg", true],
    ]);
  });

  it("checks images inside escaped comment syntax without counting them", () => {
    const md = [
      "\\<!-- ![外部](https://example.com/a.svg) -->",
      "",
      "<!-- ![隠し](diagrams/h.svg) -->",
      "",
      "![見える](diagrams/v.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/a.svg", true],
      ["diagrams/v.svg", false],
    ]);
  });

  it("allows at most one line ending around an inline destination", () => {
    const md = [
      "![x](",
      "",
      "diagrams/d.svg)",
      "",
      "![y](",
      "  diagrams/y.svg",
      '  "タイトル"',
      ")",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/y.svg", false],
    ]);
  });

  it("starts html blocks only where CommonMark does", () => {
    const md = [
      "<strong>構成:</strong>",
      "![見出しの後](diagrams/a.svg)",
      "",
      "段落",
      "<span>",
      "![段落の続き](diagrams/b.svg)",
      "",
      "<span>",
      "![ブロックの中](diagrams/c.svg)",
      "",
      "<section>見出し",
      "![ブロックの中](diagrams/d.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", false],
      ["diagrams/b.svg", false],
      ["diagrams/c.svg", true],
      ["diagrams/d.svg", true],
    ]);
  });

  it("reads escaped characters in destinations as the characters they stand for", () => {
    const md = [
      "![外部](<https://example.com/a\\>b.svg>)",
      "![括弧](diagrams/a\\(1\\).svg)",
      "![定義][d]",
      "",
      "[d]: <diagrams/b\\>c.svg>",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/a>b.svg", false],
      ["diagrams/a(1).svg", false],
      ["diagrams/b>c.svg", false],
    ]);
  });

  it("judges indented code inside the container a line really belongs to", () => {
    const md = [
      "- 項目",
      "",
      ">     ![引用の中のコード](diagrams/a.svg)",
      "",
      "- 項目",
      "",
      "  >     ![項目の引用の中のコード](diagrams/b.svg)",
      "",
      "> - 引用の項目",
      ">",
      ">   ![引用の項目の続き](diagrams/c.svg)",
      "",
      "* * *",
      "",
      "    ![区切りの後のコード](diagrams/d.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", true],
      ["diagrams/b.svg", true],
      ["diagrams/c.svg", false],
      ["diagrams/d.svg", true],
    ]);
  });

  it("lets a list item interrupt a paragraph only where CommonMark does", () => {
    const md = [
      "段落",
      "2. 番号が 1 でない項目",
      "",
      "    ![段落の後のコード](diagrams/a.svg)",
      "",
      "段落",
      "- ",
      "",
      "    ![見出しの後のコード](diagrams/b.svg)",
      "",
      "段落",
      "1. 番号が 1 の項目",
      "",
      "    ![項目の続き](diagrams/c.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", true],
      ["diagrams/b.svg", true],
      ["diagrams/c.svg", false],
    ]);
  });

  it("starts an html block after a heading or code, not in a lazy paragraph line", () => {
    const md = [
      "見出し",
      "=======",
      "<span>",
      "![見出しの後のブロック](diagrams/a.svg)",
      "",
      "    コード",
      "<span>",
      "![コードの後のブロック](diagrams/b.svg)",
      "",
      "> 引用",
      "<span>",
      "![引用の段落の続き](diagrams/c.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", true],
      ["diagrams/b.svg", true],
      ["diagrams/c.svg", false],
    ]);
  });

  it("treats an escaped comment opener inside an html block as a real one", () => {
    const md = [
      "<div>",
      "\\<!-- 注記 -->",
      "</div>",
      "",
      "![見える](diagrams/a.svg)",
      "",
      "<div>",
      "\\<!--",
      '<img src="diagrams/b.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", false],
      ["diagrams/b.svg", true],
    ]);
  });

  it("reads a definition only when its bare address balances its parentheses", () => {
    const md = [
      "![x]",
      "",
      "[x]: diagrams/d(.svg",
      "",
      "![y]",
      "",
      "[y]: diagrams/e(1).svg",
      "",
      "![z]",
      "",
      "[z]: diagrams/f\\(.svg",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/e(1).svg", false],
      ["diagrams/f(.svg", false],
    ]);
  });

  it("finds fenced code by the containers its lines belong to", () => {
    const md = [
      "- 外側",
      "  - 内側",
      "    ~~~",
      "    ![外部](https://example.com/a.svg)",
      "    ~~~",
      "",
      "> ```",
      "> ![引用のコード](https://example.com/b.svg)",
      "",
      "![引用の後](diagrams/a.svg)",
      "",
      "<!--",
      "```",
      "-->",
      "![コメントの後](diagrams/b.svg)",
      "```",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", false],
      ["diagrams/b.svg", false],
    ]);
  });

  it("reads a definition's address on the next line only inside the same container", () => {
    const md = [
      "> [x]:",
      "diagrams/a.svg",
      "",
      "![x]",
      "",
      "> [y]:",
      "> - diagrams/b.svg",
      "",
      "![y]",
      "",
      "> [z]:",
      "> diagrams/c.svg",
      "",
      "![z]",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", true],
      ["diagrams/c.svg", false],
    ]);
  });

  it("reads tabs in indentation as reaching the next tab stop of four columns", () => {
    const md = [
      "- 項目",
      "",
      "\t![タブの続き](diagrams/a.svg)",
      "",
      ">\t\t![引用のタブのコード](diagrams/b.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", false],
      ["diagrams/b.svg", true],
    ]);
  });

  it("ends an svg range at its own end tag past a self-closed svg inside it", () => {
    const md = [
      '<svg><svg/></svg><div hidden/><img src="diagrams/d.svg"></div>',
      "",
      '<img src="diagrams/v.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
      ["diagrams/v.svg", false],
    ]);
  });

  it("reads no tags inside script, style, textarea or title text", () => {
    const md = [
      '<script>const demo = "<div hidden>";</script>',
      "",
      "![見える](diagrams/v.svg)",
      "",
      `文中の <script>const s = "<img src='https://example.com/s.svg'>";</script>`,
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/v.svg", false],
    ]);
  });

  it("does not count image syntax inside an html attribute value", () => {
    const md = [
      '<span title="![x](diagrams/a.svg)">文</span>',
      "",
      "![見える](diagrams/v.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", true],
      ["diagrams/v.svg", false],
    ]);
  });

  it("reads svg content as markup, where script and style close with `/>`", () => {
    const md = [
      '<svg><script/></svg><img src="diagrams/d.svg">',
      "",
      '<svg><style/></svg><img src="diagrams/e.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", false],
      ["diagrams/e.svg", false],
    ]);
  });

  it("does not count image syntax inside link metadata", () => {
    const md = [
      "[click](<https://example.com/![x](diagrams/a.svg)>)",
      "",
      "<https://example.com/![y](diagrams/b.svg)>",
      "",
      "[ref]: https://example.com/![z](diagrams/c.svg)",
      "",
      "![見える](diagrams/v.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", true],
      ["diagrams/b.svg", true],
      ["diagrams/c.svg", true],
      ["diagrams/v.svg", false],
    ]);
  });

  it("hides inline code without joining the text around it", () => {
    const md = ["!`ignored`[x](diagrams/a.svg)", "", "`T-1` ![見える](diagrams/v.svg)"].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/v.svg", false],
    ]);
  });

  it("opens no comment at a `<!--` inside a tag or script text", () => {
    const md = [
      "![図](diagrams/d.svg)",
      '<span title="<!--"></span>',
      "![外部](https://example.com/x.svg)",
      "-->",
      "",
      '<script>var s = "<!--";</script>',
      "",
      "![外部](https://example.com/y.svg)",
      "",
      "-->",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", false],
      ["https://example.com/x.svg", false],
      ["https://example.com/y.svg", false],
    ]);
  });

  it("starts html blocks at the block tags marked uses, which include meta but not hgroup", () => {
    const md = [
      "段落",
      "<meta>",
      "![メタの後](diagrams/a.svg)",
      "",
      "段落",
      "<hgroup>",
      "![見える](diagrams/b.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", true],
      ["diagrams/b.svg", false],
    ]);
  });

  it("hides an element only by its own display or visibility declaration", () => {
    const md = [
      '<div style="--display:none"><img src="diagrams/a.svg"></div>',
      "",
      `<div style="content:'display:none'"><img src="diagrams/b.svg"></div>`,
      "",
      '<div style="color:red; DISPLAY : none !important"><img src="diagrams/c.svg"></div>',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", false],
      ["diagrams/b.svg", false],
      ["diagrams/c.svg", true],
    ]);
  });

  it("decodes a named reference in an address only with its semicolon", () => {
    const md = ["![x](diagrams/d&sol/x.svg)", "![y](diagrams&sol;y.svg)"].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d&sol/x.svg", false],
      ["diagrams/y.svg", false],
    ]);
  });

  it("decodes character references in a style attribute before reading it", () => {
    const md = [
      '<div style="display&#58;none"><img src="diagrams/d.svg"></div>',
      "",
      '<img src="diagrams/v.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
      ["diagrams/v.svg", false],
    ]);
  });

  it("reads css escapes in a resource function's name", () => {
    const md = "<style>.x{background:u\\72l(https://example.com/a.png)}</style>";
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/a.png", true],
    ]);
  });

  it("does not count an img source that its srcset can replace", () => {
    const md = [
      '<img src="diagrams/d.svg" srcset="photo.png 1x">',
      "",
      '<img src="diagrams/e.svg" srcset="diagrams/e.svg 2x">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
      ["photo.png", true],
      ["diagrams/e.svg", false],
    ]);
  });

  it("hides an element whose opacity is zero", () => {
    const md = [
      '<div style="opacity:0"><img src="diagrams/d.svg"></div>',
      "",
      '<div style="opacity:0.5"><img src="diagrams/v.svg"></div>',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
      ["diagrams/v.svg", false],
    ]);
  });

  it("decodes css escapes before reading a declaration", () => {
    const md = [
      '<div style="display:n\\6f ne"><img src="diagrams/d.svg"></div>',
      "",
      '<img src="diagrams/v.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
      ["diagrams/v.svg", false],
    ]);
  });

  it("does not count image syntax in a definition's title on the next line", () => {
    const md = [
      "[ref]: diagrams/u.svg",
      '  "![偽](diagrams/d.svg)"',
      "",
      "![見える](diagrams/v.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
      ["diagrams/v.svg", false],
    ]);
  });

  it("reads a style with css comments as the browser does", () => {
    const md = [
      '<div style="display:/**/none"><img src="diagrams/d.svg"></div>',
      "",
      '<img src="diagrams/v.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
      ["diagrams/v.svg", false],
    ]);
  });

  it("hides a code span whose closing backticks start a line", () => {
    const md = ["`", "![コード](diagrams/d.svg)", "`", "", "![見える](diagrams/v.svg)"].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/v.svg", false],
    ]);
  });

  it("checks no css address inside a css comment or a style written in script text", () => {
    const md = [
      "<style>/* url(https://example.com/a.png) */ .x{background:url(https://example.com/b.png)}</style>",
      "",
      `<script>const x = '<style>.x{background:url(https://example.com/c.png)}</style>';</script>`,
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/b.png", true],
    ]);
  });

  it("checks what an iframe's srcdoc page loads", () => {
    const md = '<iframe srcdoc="&lt;img src=&quot;/remote.svg&quot;&gt;"></iframe>';
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["/remote.svg", true],
    ]);
  });

  it("reads iframe, xmp, noembed, noframes and plaintext content as text", () => {
    const md = [
      '<iframe><img src="https://example.com/not-loaded.svg"></iframe>',
      "",
      "文中の <iframe>![i](diagrams/i.svg)</iframe>",
      "",
      '文中の <xmp><img src="diagrams/x.svg"></xmp> <noembed><img src="diagrams/e.svg"></noembed>',
      "",
      '文中の <noframes><img src="diagrams/f.svg"></noframes>',
      "",
      "![見える](diagrams/v.svg)",
      "",
      // Nothing ends plaintext, not even its own end tag.
      '文中の <plaintext><img src="diagrams/p.svg"></plaintext>',
      "",
      "![後](diagrams/after.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/i.svg", true],
      ["diagrams/v.svg", false],
      ["diagrams/after.svg", true],
    ]);
  });

  it("counts no image in a page whose style sheet may hide it", () => {
    const sheet = [
      "<style>.hidden{display:none}</style>",
      "",
      '<div class="hidden"><img src="diagrams/d.svg"></div>',
      "",
      "![見える](diagrams/v.svg)",
    ].join("\n");
    expect(findImageRefs(sheet).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
      ["diagrams/v.svg", true],
    ]);
    const linked = '<link rel="Preload StyleSheet" href="theme.css">\n\n![見える](diagrams/v.svg)';
    expect(findImageRefs(linked).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["theme.css", true],
      ["diagrams/v.svg", true],
    ]);
    // A style element with no rules, or one written as text, hides nothing.
    const harmless = [
      "<style> </style>",
      "",
      "`<style>.x{display:none}</style>`",
      "",
      "![見える](diagrams/v.svg)",
    ].join("\n");
    expect(findImageRefs(harmless).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/v.svg", false],
    ]);
  });

  it("reads a numeric reference no renderer keeps as U+FFFD", () => {
    const md = [
      "![a](diagrams/a&#0;.svg)",
      "",
      '<img src="diagrams/b&#xD800;.svg"> <img src="diagrams/c&#128;.svg">',
      "",
      "![d](diagrams/d&#x110000;.svg) ![e](diagrams/e&#46;svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "diagrams/a\u{FFFD}.svg",
      "diagrams/b\u{FFFD}.svg",
      "diagrams/c\u{FFFD}.svg",
      "diagrams/d\u{FFFD}.svg",
      "diagrams/e.svg",
    ]);
  });

  it("counts an img source whose srcset candidates all name its file", () => {
    const md = [
      '<img src="diagrams/d.svg" srcset="diagrams/d.svg?v=1 1x, ./diagrams/d.svg#top 2x">',
      "",
      '<picture><source srcset="diagrams/e.svg?v=2"><img src="diagrams/e.svg"></picture>',
      "",
      '<img src="diagrams/f.svg" srcset="diagrams/g.svg 1x">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", false],
      ["diagrams/d.svg?v=1", true],
      ["./diagrams/d.svg#top", true],
      ["diagrams/e.svg?v=2", true],
      ["diagrams/e.svg", false],
      ["diagrams/f.svg", true],
      ["diagrams/g.svg", true],
    ]);
  });

  it("reads an href on script, use, image and feImage only inside svg", () => {
    const md = [
      '<script href="https://example.com/example.js"></script>',
      "",
      '文中の <use href="https://example.com/u.svg"></use> <feImage href="https://example.com/f.svg">',
      "",
      '<svg><script href="https://example.com/svg.js"></script><use xlink:href="https://example.com/s.svg#a"></use></svg>',
      "",
      // HTML reads an <image> start tag as <img>, which loads its src.
      '文中の <image src="https://example.com/img.png">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/svg.js", true],
      ["https://example.com/s.svg#a", true],
      ["https://example.com/img.png", false],
    ]);
  });

  it("counts an html <image> as the <img> it becomes, but not an svg one", () => {
    const md = [
      '<image src="diagrams/d.svg" alt="図">',
      "",
      '<svg><image src="https://example.com/ignored.svg"></image></svg>',
    ].join("\n");
    expect(findImageRefs(md)).toEqual([{ alt: "図", path: "diagrams/d.svg", uncertain: false }]);
  });

  it("does not count an image inside a closed details or dialog", () => {
    const md = [
      "<details>",
      "<summary>図</summary>",
      "",
      "![閉じた](diagrams/x.svg)",
      "",
      "</details>",
      "",
      "<details open>",
      "<summary>図</summary>",
      "",
      "![開いた](diagrams/y.svg)",
      "",
      "</details>",
      "",
      '文中の <dialog><img src="diagrams/z.svg"></dialog> と <dialog open><img src="diagrams/w.svg"></dialog>',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/x.svg", true],
      ["diagrams/y.svg", false],
      ["diagrams/z.svg", true],
      ["diagrams/w.svg", false],
    ]);
  });

  it("counts an image in the summary a closed details still shows", () => {
    const md = [
      '<details><summary><img src="diagrams/s.svg"></summary>',
      "",
      "![本文](diagrams/b.svg)",
      "",
      "</details>",
      "",
      '<details hidden><summary><img src="diagrams/h.svg"></summary></details>',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/s.svg", false],
      ["diagrams/b.svg", true],
      ["diagrams/h.svg", true],
    ]);
  });

  it("reads the inline declaration that wins", () => {
    const md = [
      '<img style="display:none; display:block" src="diagrams/a.svg">',
      '<img style="display:none !important; display:block" src="diagrams/b.svg">',
      // A value CSS does not know is dropped, so the earlier one still applies.
      '<img style="display:none; display:bogus" src="diagrams/c.svg">',
      '<img style="visibility:hidden; visibility:visible" src="diagrams/d.svg">',
      // A backslash before a line break escapes nothing in a CSS name.
      '<img style="display:n\\',
      'one" src="diagrams/e.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", false],
      ["diagrams/b.svg", true],
      ["diagrams/c.svg", true],
      ["diagrams/d.svg", false],
      ["diagrams/e.svg", false],
    ]);
  });

  it("reads only the top-level strings of an image-set() as its images", () => {
    const md = `<div style='background-image:image-set(url("diagrams/d.svg") type("image/svg+xml") 1x, "diagrams/e.svg" type("image/svg+xml") 2x)'>x</div>`;
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual(["diagrams/d.svg", "diagrams/e.svg"]);
  });

  it("reads a css string cut short by a line break or the end, as css does", () => {
    const md = [
      // A string left open runs to the end, so the url() inside it loads nothing.
      '<div style="--x:&quot;url(https://example.com/x.png)">x</div>',
      // A url() that the end closes still loads.
      '<div style="background:url(&quot;https://example.com/y.png">x</div>',
      '<div style="background:url(https://example.com/z.png">x</div>',
      // A line break ends a string as a bad one, and what follows it is read.
      '<div style="--a:&quot;abc&#10;; background:url(https://example.com/w.png); --b:&quot;">x</div>',
      '<div style="--a:&quot;abc&#10;; display:none; --b:&quot;"><img src="diagrams/d.svg"></div>',
      '<div style="--x:&quot;; display:none"><img src="diagrams/e.svg"></div>',
    ].join("\n\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/y.png", true],
      ["https://example.com/z.png", true],
      ["https://example.com/w.png", true],
      ["diagrams/d.svg", true],
      ["diagrams/e.svg", false],
    ]);
  });

  it("checks the addresses svg animation sets on a loading attribute", () => {
    const md = [
      '<svg><image href="diagrams/d.svg"><set attributeName="href" to="https://example.com/x.png" begin="0s"/></image></svg>',
      "",
      '<svg><rect><animate attributeName="fill" values="red;url(https://example.com/p.svg#g)" dur="1s"/></rect></svg>',
      "",
      // An animation of an attribute that loads nothing names no address.
      '<svg><rect><animate attributeName="x" from="0" to="10" dur="1s"/></rect></svg>',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "diagrams/d.svg",
      "https://example.com/x.png",
      "https://example.com/p.svg#g",
    ]);
  });

  it("decodes svg animation values before it splits them", () => {
    const md =
      '<svg><image href="diagrams/d.svg"><animate attributeName="href" values="diagrams/e.svg&#59https://example.com/x.png" dur="1s"/></image></svg>';
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "diagrams/d.svg",
      "diagrams/e.svg",
      "https://example.com/x.png",
    ]);
  });

  it("splits a style only at the semicolons outside its blocks", () => {
    const md = [
      '<img style="--x:foo(a;display:none;b)" src="diagrams/a.svg">',
      '<img style="display:none; --x:foo(a;display:block;b)" src="diagrams/b.svg">',
      '<img style="--x:[a;display:none]; --y:{b;display:none}" src="diagrams/c.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", false],
      ["diagrams/b.svg", true],
      ["diagrams/c.svg", false],
    ]);
  });

  it("reads a quote inside an unquoted attribute value as part of it", () => {
    const md = "<div>\n<img src=https://example.com/x.png'>\n</div>";
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual(["https://example.com/x.png'"]);
  });

  it("leaves svg or math content where a breakout tag returns to html", () => {
    const md = [
      '<svg><font color="red"><image src="https://example.com/a.png"></svg>',
      "",
      // A <font> without color, face or size stays SVG, and the <image> there loads no src.
      '<svg><font><image src="https://example.com/b.png"></image></font></svg>',
      "",
      '<svg><g><div><image src="https://example.com/c.png"></div></g></svg>',
      "",
      '<math><mi>x</mi><p><image src="https://example.com/d.png"></p></math>',
      "",
      '<svg></p><image src="https://example.com/e.png"></svg>',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "https://example.com/a.png",
      "https://example.com/c.png",
      "https://example.com/d.png",
      "https://example.com/e.png",
    ]);
  });

  it("opens an html island only at an integration point of its own namespace", () => {
    const md = [
      // In SVG, <annotation-xml> and <mi> are SVG elements, so an <image href> there loads.
      '<svg><annotation-xml encoding="text/html"><image href="https://example.com/x.png"/></annotation-xml></svg>',
      "",
      '<svg><mi><image href="https://example.com/y.png"/></mi></svg>',
      "",
      // In MathML, <desc> is no integration point: the <image> stays MathML and loads nothing.
      '<math><desc><image src="https://example.com/z.png"></image></desc></math>',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "https://example.com/x.png",
      "https://example.com/y.png",
    ]);
  });

  it("reads a negative width, height or maximum as invalid, never as zero", () => {
    const md = [
      '<img src="diagrams/a.svg" style="width:-1px">',
      '<img src="diagrams/b.svg" style="max-height:-5%">',
      // An invalid declaration displaces nothing, so the zero before it still applies.
      '<img src="diagrams/c.svg" style="width:0; width:-1px">',
      '<img src="diagrams/d.svg" style="width:-0px">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", false],
      ["diagrams/b.svg", false],
      ["diagrams/c.svg", true],
      ["diagrams/d.svg", true],
    ]);
  });

  it("reads srcset candidates as the HTML parser splits them", () => {
    const md = [
      // A comma inside an address is part of it; the commas that end one are not.
      '<img src="diagrams/a,b.svg" srcset="diagrams/a,b.svg 1x">',
      // So this candidate is one other file, which a 2x screen shows instead.
      '<img src="diagrams/c.svg" srcset="diagrams/c.svg,diagrams/c.svg 2x">',
      '<img src="diagrams/d.svg" srcset="diagrams/d.svg 1x,, diagrams/d.svg, diagrams/d.svg 2x">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a,b.svg", false],
      ["diagrams/c.svg", true],
      ["diagrams/c.svg,diagrams/c.svg", true],
      ["diagrams/d.svg", false],
    ]);
  });

  it("reads an escape outside a css string as a character, never a delimiter", () => {
    const md = [
      // CSS reads `\"` and `\27 ` as part of the address, which loads.
      `<div style='background:url(https://example.com/a\\"b.png)'>x</div>`,
      "",
      "<div style='background:url(https://example.com/e\\27 x.png)'>x</div>",
      "",
      // An escaped `)` does not end an unquoted url(), and an escaped `(` opens no function.
      "<div style='background:url(diagrams/a\\)b.svg), url\\(https://example.com/c.png)'>x</div>",
      "",
      // An escaped quote opens no string, so the declaration after it applies.
      `<div style='--x:a\\"; display:none; --y:"'><img src="diagrams/d.svg"></div>`,
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ['https://example.com/a"b.png', true],
      ["https://example.com/e'x.png", true],
      ["diagrams/a)b.svg", true],
      ["diagrams/d.svg", true],
    ]);
  });

  it("splits a style at its semicolons before reading escapes", () => {
    const md = [
      // An escaped `;` stays inside the custom property's value.
      '<img style="--x:a\\;display:none" src="diagrams/a.svg">',
      '<img style="display:none; --x:a\\;display:block" src="diagrams/b.svg">',
      // After an escaped backslash, the `;` still ends the declaration.
      '<img style="--x:a\\\\;display:none" src="diagrams/c.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", false],
      ["diagrams/b.svg", true],
      ["diagrams/c.svg", true],
    ]);
  });

  it("decodes a named reference only by its exact name", () => {
    // `&Tab;` is a tab and `&tab;` no reference; `&Quot;` and `&constructor;` stay as written.
    const md = [
      '<img src="diagrams/a&Tab;.svg">',
      '<img src="diagrams/b&tab;.svg">',
      '<img src="diagrams/c&Quot;.svg">',
      '<img src="diagrams/d&constructor;.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "diagrams/a.svg",
      "diagrams/b&tab;.svg",
      "diagrams/c&Quot;.svg",
      "diagrams/d&constructor;.svg",
    ]);
  });

  it("checks an input's src only when it is an image button", () => {
    const md =
      '文中の <input type="text" src="https://example.com/x.png"> <input type="IM&#65;GE" src="https://example.com/y.png"> <input src="https://example.com/z.png">';
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/y.png", true],
    ]);
  });

  it("checks the href of svg paint servers and other referencing elements", () => {
    const md =
      '<svg><linearGradient id="g" href="https://example.com/g.svg#g"></linearGradient><pattern xlink:href="https://example.com/p.svg#p"></pattern><filter href="https://example.com/f.svg#f"></filter><rect fill="url(#g)"/></svg>';
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/g.svg#g", true],
      ["https://example.com/p.svg#p", true],
      ["https://example.com/f.svg#f", true],
    ]);
  });

  it("reads every digit of a numeric reference", () => {
    const md = [
      '<img src="https&#00000000000058;//example.com/x.png">',
      "",
      '<img src="diagrams/b&#99999999999;.svg"> <img src="diagrams/c&#x000000000041;.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "https://example.com/x.png",
      "diagrams/b\u{FFFD}.svg",
      "diagrams/cA.svg",
    ]);
  });

  it("reads html again inside svg integration points", () => {
    const md = [
      // Inside <foreignObject> an <image> start tag is HTML's <img>, which loads its src.
      '<svg><foreignObject><image src="https://example.com/x.png"></foreignObject></svg>',
      "",
      // <desc> content is HTML but never drawn.
      '<svg><desc><img src="diagrams/d.svg"></desc></svg>',
      "",
      // An <svg> inside <foreignObject> is svg again.
      '<svg><foreignObject><svg><use href="https://example.com/u.svg#u"></use></svg></foreignObject></svg>',
      "",
      // HTML ignores `/>` there, so the hidden div stays open around the image.
      '<svg><foreignObject><div hidden/><img src="diagrams/h.svg"></div></foreignObject></svg>',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/x.png", false],
      ["diagrams/d.svg", true],
      ["https://example.com/u.svg#u", true],
      ["diagrams/h.svg", true],
    ]);
  });

  it("decodes a srcset before splitting its candidates", () => {
    const md =
      '<img src="diagrams/d.svg" srcset="diagrams/d.svg 1x&#44; https://example.com/x.svg 2x">';
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
      ["https://example.com/x.svg", true],
    ]);
  });

  it("reads url() and image-set() only as whole function names", () => {
    const md =
      '<div style="--example:curl(https://example.com/help); --set:my-image-set(&quot;https://example.com/s.png&quot;); background:url(https://example.com/u.png), -webkit-image-set(&quot;https://example.com/w.png&quot; 1x)">x</div>';
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "https://example.com/u.png",
      "https://example.com/w.png",
    ]);
  });

  it("keeps a decoded tab or line break in a style apart, but drops it from an address", () => {
    const md = [
      // To CSS, `u&#9;rl(` is two tokens and loads nothing.
      '<div style="background:u&#9;rl(https://example.com/x.png)">x</div>',
      "",
      '<svg><rect fill="u&#10;rl(https://example.com/z.png)"/></svg>',
      "",
      // Inside an address, the URL parser drops it: this loads https://example.com/y.png.
      '<div style="background:url(&quot;https://exa&#9;mple.com/y.png&quot;)">x</div>',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual(["https://example.com/y.png"]);
  });

  it("reads annotation-xml as html only with an html encoding", () => {
    const md = [
      '<math><annotation-xml encoding="application/xml"><image src="https://example.com/x.png"></image></annotation-xml></math>',
      "",
      '<math><annotation-xml encoding="TEXT/HTML"><image src="https://example.com/y.png"></annotation-xml></math>',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual(["https://example.com/y.png"]);
  });

  it("reads an image-set() to its balanced end", () => {
    const md = `<div style='background-image:image-set(linear-gradient(rgb(1,2,3), blue) 1x, "https://example.com/x.png" 2x)'>x</div>`;
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual(["https://example.com/x.png"]);
  });

  it("reads a css string whole before its escapes", () => {
    const md = [
      `<div style='background:url("https://example.com/a\\"b.png")'>x</div>`,
      "",
      "<style>.x{background:url('diagrams/a/*b.png')} .y{background:url(diagrams/c.png)}</style>",
      "",
      // Text inside a string that is no url() argument loads nothing.
      `文中の <span style='--example:"url(https://example.com/help)"'>x</span>`,
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      'https://example.com/a"b.png',
      "diagrams/a/*b.png",
      "diagrams/c.png",
    ]);
  });

  it("reads a quoted css url through its closing quote", () => {
    const md = [
      `<div style='background:url("diagrams/a).png")'>x</div>`,
      "",
      "<style>.x{background:url('diagrams/b).png') , url(diagrams/c.png)}</style>",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "diagrams/a).png",
      "diagrams/b).png",
      "diagrams/c.png",
    ]);
  });

  it("does not count an image inside a select, which draws none", () => {
    const md = '<select><img src="diagrams/d.svg"><option>a</option></select>';
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
    ]);
  });

  it("reads display: contents as no box on an img, but not on its container", () => {
    const md = [
      '<img style="display:contents" src="diagrams/d.svg">',
      '<div style="display:contents"><img src="diagrams/e.svg"></div>',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
      ["diagrams/e.svg", false],
    ]);
  });

  it("reads a style's strings and comments together", () => {
    const md = `<div style='--x:"/*";display:none'><img src="diagrams/h.svg"></div>`;
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/h.svg", true],
    ]);
  });

  it("does not count an img with no area", () => {
    const md = [
      '<img src="diagrams/a.svg" width="0" height="10">',
      '<img src="diagrams/b.svg" height=" 0px">',
      '<img src="diagrams/c.svg" style="width:0">',
      '<img src="diagrams/d.svg" style="max-height:0px; height:10px">',
      // A later declaration wins, and an attribute HTML cannot read as a number is ignored.
      '<img src="diagrams/e.svg" width="300" style="width:0; width:auto">',
      '<img src="diagrams/f.svg" width="abc">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", true],
      ["diagrams/b.svg", true],
      ["diagrams/c.svg", true],
      ["diagrams/d.svg", true],
      ["diagrams/e.svg", false],
      ["diagrams/f.svg", false],
    ]);
  });

  it("checks url() addresses in svg presentation attributes", () => {
    const md = [
      '<svg><rect fill="url(https://example.com/paint.svg#g)" filter="url(#local)"></rect><path stroke="url(&quot;https://example.com/s.svg#p&quot;)"/></svg>',
      "",
      '文中の <span fill="url(https://example.com/ignored.svg)">HTML の fill は何も読み込まない</span>',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/paint.svg#g", true],
      ["https://example.com/s.svg#p", true],
    ]);
  });

  it("decodes a link's relations before reading them", () => {
    const md = '<link rel="style&#115;heet" href="hide.css">\n\n![見える](diagrams/v.svg)';
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["hide.css", true],
      ["diagrams/v.svg", true],
    ]);
  });

  it("opens no code span at an escaped backtick", () => {
    const md = [
      "区切りは \\` です。![図](diagrams/d.svg) と `code` を使う",
      "",
      "\\`![x](diagrams/x.svg) \\`",
      "",
      // An escaped backslash leaves the backtick after it free to open a code span.
      "\\\\`![y](diagrams/y.svg)`",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", false],
      ["diagrams/x.svg", false],
    ]);
  });

  it("opens a code span only at the start of a backtick run", () => {
    const md = [
      // Two backticks with no two-backtick closer open nothing, not even from their second one.
      "`` ![x](diagrams/x.svg) `",
      "",
      // After an escaped backtick, the run that follows opens a code span.
      "\\```![z](diagrams/z.svg)``",
      "",
      "\\\\``![w](diagrams/w.svg)`",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/x.svg", false],
      ["diagrams/w.svg", false],
    ]);
  });

  it("checks a link's address only when its relation loads it", () => {
    const md = [
      '<link rel="canonical" href="https://example.com/page">',
      '<link rel="Author License" href="https://example.com/about">',
      '<link href="https://example.com/no-rel">',
      '<link rel="icon" href="https://example.com/icon.png">',
      '<link rel="alternate stylesheet" href="https://example.com/alt.css">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/icon.png", true],
      ["https://example.com/alt.css", true],
    ]);
  });

  it("does not count an img source holding a reference without its `;`", () => {
    // In an attribute a browser decodes `&amp/` to `&/`; Markdown keeps it as written.
    const md = [
      '<img src="diagrams/a&amp/b.svg">',
      "",
      '<img src="diagrams/x&amp;y.svg"> <img src="diagrams/q&amp=1.svg">',
      "",
      "![md](diagrams/a&amp/c.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a&amp/b.svg", true],
      ["diagrams/x&y.svg", false],
      ["diagrams/q&amp=1.svg", false],
      ["diagrams/a&amp/c.svg", false],
    ]);
  });

  it("rejects a title that holds a blank line", () => {
    const md = [
      '![x](diagrams/a.svg "タイ',
      "",
      'トル")',
      "",
      '![y](diagrams/b.svg "タイ',
      'トル")',
      "",
      "![z][d]",
      "",
      '[d]: diagrams/c.svg "タイ',
      "",
      'トル"',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/b.svg", false],
    ]);
  });

  it("ignores html tags whose `<` is escaped", () => {
    const md = ['\\<img src="diagrams/d.svg">', "", '\\\\<img src="diagrams/e.svg">'].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/e.svg", false],
    ]);
  });

  it("reads only well-formed inline images, titles and balanced parentheses included", () => {
    const md = [
      "![x](diagrams/a.svg garbage)",
      '![y](diagrams/b.svg "タイトル")',
      "![z](diagrams/c(1).svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/b.svg", false],
      ["diagrams/c(1).svg", false],
    ]);
  });

  it("finds a hidden element's real end tag, not one inside quotes or script text", () => {
    const md = [
      '<div hidden><span title="</div>"></span><img src="diagrams/d.svg"></div>',
      "",
      '<div hidden><script>var s = "</div>";</script><img src="diagrams/s.svg"></div>',
      "",
      '<img src="diagrams/v.svg">',
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
      ["diagrams/s.svg", true],
      ["diagrams/v.svg", false],
    ]);
  });

  it("keeps a hidden element open after `/>` unless it is void or inside svg", () => {
    const md = [
      '<div hidden/><img src="diagrams/d.svg"></div>',
      "",
      '<svg><g style="display:none"/></svg>',
      "",
      "![見える](diagrams/v.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/d.svg", true],
      ["diagrams/v.svg", false],
    ]);
  });

  it("does not count images that HTML never shows", () => {
    const md = [
      '<template><img src="diagrams/a.svg"></template>',
      '<img hidden src="diagrams/b.svg">',
      '<div hidden><p><div><img src="diagrams/c.svg"></div></p></div>',
      '<span style="display: none"><img src="diagrams/d.svg"></span>',
      '<img alt="was hidden" src="diagrams/e.svg">',
      '<img aria-hidden="true" src="diagrams/f.svg">',
      "",
      "文中の <template>![隠し](diagrams/g.svg)</template>",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", true],
      ["diagrams/b.svg", true],
      ["diagrams/c.svg", true],
      ["diagrams/d.svg", true],
      ["diagrams/e.svg", false],
      ["diagrams/f.svg", false],
      ["diagrams/g.svg", true],
    ]);
  });

  it("does not count images whose definition continues a paragraph", () => {
    const md = [
      "本文の段落",
      "[x]: diagrams/a.svg",
      "",
      "![x]",
      "",
      "[y]: diagrams/b.svg",
      "",
      "![y]",
      "",
      "段落",
      "[p]: diagrams/c.svg",
      "[q]: diagrams/d.svg",
      "",
      "![q]",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", true],
      ["diagrams/b.svg", false],
      ["diagrams/d.svg", true],
    ]);
  });

  it("matches reference labels with Unicode case folding", () => {
    const md = ["![外部][ß]", "", "[SS]: https://example.com/a.svg"].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/a.svg", false],
    ]);
  });

  it("reads reference definitions inside blockquotes and list items", () => {
    const md = [
      "![外部][shot]",
      "![一覧][item]",
      "",
      "> [shot]: https://example.com/a.svg",
      "",
      "- [item]:",
      "  https://example.com/b.svg",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/a.svg", false],
      ["https://example.com/b.svg", false],
    ]);
  });

  it("reads a reference definition whose address is on the next line", () => {
    const md = ["![外部][shot]", "", "[shot]:", "  https://example.com/a.svg"].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/a.svg", false],
    ]);
  });

  it("follows reference images whose alt text holds nested brackets", () => {
    const md = [
      "![a [b] c][remote]",
      "![a [b [c]] d][local]",
      "",
      "[remote]: https://example.com/x.svg",
      "[local]: diagrams/a.svg",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["https://example.com/x.svg", false],
      ["diagrams/a.svg", false],
    ]);
  });

  it("checks the string candidates of css image-set()", () => {
    const md = [
      '<style>.x{background-image:image-set("/remote.svg" 1x, url("diagrams/hi.svg") 2x)}</style>',
      "<div style=\"background-image:-webkit-image-set('diagrams/w.svg' 1x)\">x</div>",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["/remote.svg", true],
      ["diagrams/hi.svg", true],
      ["diagrams/w.svg", true],
    ]);
  });

  it("ignores image syntax whose `!` is escaped, which shows a link", () => {
    const md = [
      "\\![見本](diagrams/a.svg)",
      "\\\\![本物](diagrams/b.svg)",
      "\\![参照][r]",
      "",
      "[r]: diagrams/c.svg",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/b.svg", false],
    ]);
  });

  it("marks images under raw html blocks inside blockquotes and list items", () => {
    const md = [
      "> <pre>",
      "> ![引用](diagrams/a.svg)",
      "> </pre>",
      "",
      "- <div>",
      "  ![項目](diagrams/b.svg)",
      "",
      "10. 番号",
      "    <pre>",
      "    ![続き](diagrams/c.svg)",
      "    </pre>",
      "",
      "> <div>",
      ">",
      "> ![空行の後](diagrams/d.svg)",
      "",
      "![外](diagrams/e.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", true],
      ["diagrams/b.svg", true],
      ["diagrams/c.svg", true],
      ["diagrams/d.svg", false],
      ["diagrams/e.svg", false],
    ]);
  });

  it("marks images inside processing-instruction, declaration and CDATA blocks", () => {
    const md = [
      "<?instruction",
      "![pi](diagrams/a.svg)",
      "?>",
      "<!DOCTYPE x",
      "![decl](diagrams/b.svg)",
      ">",
      "<![CDATA[",
      '![cdata](diagrams/c.svg) <img src="diagrams/d.svg">',
      "]]>",
      "",
      "![外](diagrams/e.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", true],
      ["diagrams/b.svg", true],
      ["diagrams/c.svg", true],
      ["diagrams/d.svg", true],
      ["diagrams/e.svg", false],
    ]);
  });

  it("marks markdown images inside raw html blocks, which show them as text", () => {
    const md = [
      "<pre>",
      "![pre](diagrams/a.svg)",
      "</pre>",
      "<div>",
      "![div](diagrams/b.svg)",
      '<img src="diagrams/c.svg">',
      "",
      "![外](diagrams/d.svg)",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", true],
      ["diagrams/b.svg", true],
      ["diagrams/c.svg", false],
      ["diagrams/d.svg", false],
    ]);
  });

  it("marks images on lines indented like code", () => {
    const md =
      "![見える](diagrams/a.svg)\n\n    ![字下げ](diagrams/b.svg)\n\t![タブ](diagrams/c.svg)";
    expect(findImageRefs(md).map((ref) => [ref.path, ref.uncertain])).toEqual([
      ["diagrams/a.svg", false],
      ["diagrams/b.svg", true],
      ["diagrams/c.svg", true],
    ]);
  });

  it("collects reference-style images that have a definition", () => {
    const md = [
      "![画面][shot]",
      "![Logo][]",
      "![図]",
      "![未定義][none]",
      "[リンク][shot]",
      "",
      "[shot]: https://example.com/a.png",
      '[logo]: <diagrams/logo.svg> "ロゴ"',
      "[図]: diagrams/z.svg",
    ].join("\n");
    expect(findImageRefs(md).map((ref) => ref.path)).toEqual([
      "https://example.com/a.png",
      "diagrams/logo.svg",
      "diagrams/z.svg",
    ]);
  });
});

describe("checkMarkdown", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "focus-diagram-"));
    mkdirSync(path.join(dir, "diagrams"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function write(relative: string, content: string) {
    writeFileSync(path.join(dir, relative), content);
  }
  function codes(file = "doc.md", minDiagrams = 0) {
    return checkMarkdown(path.join(dir, file), { minDiagrams }).violations.map((v) => v.code);
  }

  it("counts a freely drawn svg without any source data", () => {
    write("diagrams/d.svg", drawn);
    write("doc.md", "# 設計\n\n![構成](diagrams/d.svg)\n");
    expect(checkMarkdown(path.join(dir, "doc.md"), { minDiagrams: 1 })).toEqual({
      pass: true,
      diagrams: 1,
      violations: [],
    });
  });

  it("counts mermaid diagrams beside svg images", () => {
    write("diagrams/d.svg", drawn);
    write("doc.md", "![構成](diagrams/d.svg)\n\n```mermaid\nflowchart LR\n  A --> B\n```\n");
    expect(checkMarkdown(path.join(dir, "doc.md"), { minDiagrams: 2 })).toEqual({
      pass: true,
      diagrams: 2,
      violations: [],
    });
  });

  it("rejects a mermaid block that names no diagram, and does not count it", () => {
    write("doc.md", "```mermaid\nA --> B\n```\n");
    expect(codes("doc.md", 1)).toEqual(["unknown-mermaid", "no-diagram"]);
  });

  it("does not count a mermaid diagram the reader may not see", () => {
    write("doc.md", "<style>pre{display:none}</style>\n\n```mermaid\nflowchart LR\n```\n");
    expect(codes("doc.md", 1)).toEqual(["no-diagram"]);
  });

  it("checks every svg it embeds for content that is unsafe to open, naming the image", () => {
    write("diagrams/bad.svg", '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>');
    write("diagrams/d.svg", drawn);
    write("doc.md", "![構成](diagrams/d.svg)\n\n    ![例](diagrams/bad.svg)\n");
    const report = checkMarkdown(path.join(dir, "doc.md"), { minDiagrams: 1 });
    expect(report.violations).toEqual([
      expect.objectContaining({ code: "svg-script", target: "diagrams/bad.svg" }),
    ]);
    expect(report.diagrams).toBe(1);
  });

  it("reports an svg that is too large without reading it", () => {
    write("diagrams/big.svg", `<svg viewBox="0 0 1 1"><!-- ${"x".repeat(MAX_SVG_BYTES)} --></svg>`);
    write("doc.md", "![大きい](diagrams/big.svg)");
    expect(codes("doc.md", 1)).toEqual(["svg-too-large", "no-diagram"]);
  });

  it("rejects external, absolute and escaping image paths", () => {
    write(
      "doc.md",
      [
        "![外部](https://example.com/a.svg)",
        "![絶対](/etc/a.svg)",
        "![外側](../a.svg)",
        "![data](data:image/svg+xml;base64,AAAA)",
      ].join("\n"),
    );
    expect(codes()).toEqual(["external-image", "absolute-path", "outside-path", "external-image"]);
  });

  it("checks reference-style images like inline ones", () => {
    write("diagrams/d.svg", drawn);
    write(
      "doc.md",
      "![流れ](diagrams/d.svg)\n![画面][shot]\n\n[shot]: https://example.com/a.png\n",
    );
    expect(codes("doc.md", 1)).toEqual(["external-image"]);
  });

  it("finds the file an address names without its fragment or query", () => {
    write("diagrams/d.svg", drawn);
    write("diagrams/icons.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"/>');
    write(
      "doc.md",
      [
        "![流れ](diagrams/d.svg#top)",
        '<svg><use href="diagrams/icons.svg#check"></use></svg>',
        '<img src="diagrams/d.svg?v=2">',
        '<svg><use href="diagrams/none.svg#check"></use></svg>',
      ].join("\n"),
    );
    expect(codes("doc.md", 1)).toEqual(["missing-image"]);
  });

  it("reports a malformed percent escape instead of throwing", () => {
    write("doc.md", "![壊れた](diagrams/100%.svg)\n![外側](../a.svg)");
    expect(codes()).toEqual(["invalid-path", "outside-path"]);
  });

  it("reports missing images and svg files that are not drawings", () => {
    write("doc.md", "![a](diagrams/a.svg)\n![b](diagrams/b.svg)");
    write("diagrams/b.svg", "<html/>");
    expect(codes()).toEqual(["missing-image", "not-svg"]);
  });

  it("rejects an external candidate beside a valid local diagram", () => {
    write("diagrams/d.svg", drawn);
    // The srcset candidate may be shown instead of the diagram, so the diagram does not count.
    write("doc.md", '<img src="diagrams/d.svg" srcset="https://example.com/remote.svg 1x">');
    expect(codes("doc.md", 1)).toEqual(["external-image", "no-diagram"]);
    write("doc.md", "![流れ](diagrams/d.svg)\n![cdn](//cdn.example.com/a.png)");
    expect(codes("doc.md", 1)).toEqual(["external-image"]);
  });

  it("counts a diagram embedded with an html image tag but not one written inside <pre>", () => {
    write("diagrams/d.svg", drawn);
    write("doc.md", '<img src="diagrams/d.svg" alt="流れ">\n');
    expect(codes("doc.md", 1)).toEqual([]);
    write("doc.md", "<pre>\n![流れ](diagrams/d.svg)\n</pre>\n");
    expect(codes("doc.md", 1)).toEqual(["no-diagram"]);
  });

  it("checks images on indented lines but does not count them as diagrams", () => {
    write("diagrams/d.svg", drawn);
    write(
      "doc.md",
      [
        "例:",
        "",
        "    ![図](diagrams/d.svg)",
        "    ![ない](diagrams/none.svg)",
        "    <img src=https://example.com/a.svg>",
      ].join("\n"),
    );
    expect(codes("doc.md", 1)).toEqual(["missing-image", "external-image", "no-diagram"]);
  });

  it("does not count an image inside a code block left open at the end", () => {
    write("diagrams/d.svg", drawn);
    write("doc.md", "# 設計\n\n```\n![図](diagrams/d.svg)\n");
    expect(codes("doc.md", 1)).toEqual(["no-diagram"]);
  });

  it("rejects a character reference in an image path that the check cannot decode", () => {
    write(
      "doc.md",
      ['<img src="&bsol;outside.svg">', "", "![参照](diagrams/&frac12;.svg)"].join("\n"),
    );
    expect(codes()).toEqual(["unknown-reference", "unknown-reference"]);
  });

  it("accepts a contained file whose name begins with two dots", () => {
    write("..d.svg", drawn);
    write("diagrams/..e.svg", drawn);
    write("doc.md", "![流れ](..d.svg)\n\n![流れ](diagrams/..e.svg)");
    expect(checkMarkdown(path.join(dir, "doc.md"), { minDiagrams: 2 })).toEqual({
      pass: true,
      diagrams: 2,
      violations: [],
    });
  });

  it("rejects a diagram that a link leads out of the document's folder", () => {
    const outside = mkdtempSync(path.join(tmpdir(), "focus-outside-"));
    try {
      writeFileSync(path.join(outside, "d.svg"), drawn);
      // A junction needs no privileges on Windows; elsewhere it is a directory link.
      symlinkSync(outside, path.join(dir, "linked"), "junction");
      write("doc.md", "![流れ](linked/d.svg)");
      expect(codes("doc.md", 1)).toEqual(["outside-path", "no-diagram"]);
      // A link that stays inside the folder is fine.
      write("diagrams/d.svg", drawn);
      symlinkSync(path.join(dir, "diagrams"), path.join(dir, "same"), "junction");
      write("doc.md", "![流れ](same/d.svg)");
      expect(codes("doc.md", 1)).toEqual([]);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects css or a srcdoc holding a character reference the check cannot read", () => {
    write("diagrams/d.svg", drawn);
    write(
      "doc.md",
      [
        "![流れ](diagrams/d.svg)",
        "",
        // A browser reads `&lpar;` as `(` and loads https://example.com/x.png.
        '<div style="background:url&lpar;https://example.com/x.png)">x</div>',
        "",
        // It reads `&quot` as `"` even without its `;`, which ends the string the check would see.
        `<div style='--a:&quot x"; background:url(https://example.com/y.png); --b:"y"'>x</div>`,
        "",
        '<svg><rect fill="url&lpar;https://example.com/z.svg#p)"/></svg>',
        "",
        '<iframe srcdoc="<img src&equals;https://example.com/w.png>"></iframe>',
      ].join("\n"),
    );
    expect(codes("doc.md", 1)).toEqual([
      "unknown-reference",
      "unknown-reference",
      "unknown-reference",
      "unknown-reference",
    ]);
    // A reference the check reads, or text that is no reference, is fine.
    write(
      "doc.md",
      [
        "![流れ](diagrams/d.svg)",
        "",
        '<div style="content:&quot;a&amp;b&quot;; --q:x&y=1">x</div>',
      ].join("\n"),
    );
    expect(codes("doc.md", 1)).toEqual([]);
  });

  it("checks an address without the spaces a browser strips from its ends", () => {
    write("doc.md", '<img src=" /remote.svg">\n');
    expect(codes()).toEqual(["absolute-path"]);
  });

  it("rejects backslashes in image paths, which renderers read differently", () => {
    write(
      "doc.md",
      ['<img src="diagrams\\..\\..\\outside.svg">', "", "![区切り](diagrams\\a.svg)"].join("\n"),
    );
    expect(codes()).toEqual(["backslash-path", "backslash-path"]);
  });

  it("does not take a url in text attributes such as alt for something the page loads", () => {
    write("diagrams/d.svg", drawn);
    write(
      "doc.md",
      '<img src="diagrams/d.svg" alt="See https://example.com/help" title="https://example.com/t">\n',
    );
    expect(codes("doc.md", 1)).toEqual([]);
  });

  it("checks only attributes that load something, not data-* or value", () => {
    write("diagrams/d.svg", drawn);
    write(
      "doc.md",
      '<img src="diagrams/d.svg" data-doc="https://example.com/help" value="https://example.com/v">\n',
    );
    expect(codes("doc.md", 1)).toEqual([]);
  });

  it("checks an attribute only on the elements that load from it", () => {
    write("diagrams/d.svg", drawn);
    write(
      "doc.md",
      [
        '<img src="diagrams/d.svg">',
        "",
        '<div href="https://example.com/help" poster="https://example.com/p.png"></div>',
        "",
        '<video poster="https://example.com/v.png"></video>',
      ].join("\n"),
    );
    expect(codes("doc.md", 1)).toEqual(["external-image"]);
  });

  it("rejects a root-relative candidate beside a valid local diagram", () => {
    write("diagrams/d.svg", drawn);
    write(
      "doc.md",
      '<picture><source srcset="/remote.svg 1x"><img src="diagrams/d.svg"></picture>\n',
    );
    expect(codes("doc.md", 1)).toEqual(["absolute-path", "no-diagram"]);
  });

  it("rejects a base element, which moves where every relative path loads from", () => {
    write("diagrams/d.svg", drawn);
    write("doc.md", '<base href="subdir/index.html">\n\n<img src="diagrams/d.svg">\n');
    expect(codes("doc.md", 1)).toEqual(["base-element"]);
  });

  it("rejects a base element inside an iframe's srcdoc", () => {
    write("diagrams/d.svg", drawn);
    mkdirSync(path.join(dir, "sub"));
    write("sub/index.html", "<p>x</p>");
    write(
      "doc.md",
      '![流れ](diagrams/d.svg)\n\n<iframe srcdoc="&lt;base href=&quot;sub/index.html&quot;&gt;&lt;img src=&quot;diagrams/d.svg&quot;&gt;"></iframe>\n',
    );
    expect(codes("doc.md", 1)).toEqual(["base-element"]);
  });

  it("does not count a diagram in a page with a style sheet that can hide it", () => {
    write("diagrams/d.svg", drawn);
    write(
      "doc.md",
      '<style>.hidden{display:none}</style>\n\n<div class="hidden"><img src="diagrams/d.svg"></div>\n',
    );
    expect(codes("doc.md", 1)).toEqual(["no-diagram"]);
  });

  it("accepts an iframe whose fallback text names an external image", () => {
    write("diagrams/d.svg", drawn);
    write(
      "doc.md",
      '![流れ](diagrams/d.svg)\n\n<iframe><img src="https://example.com/not-loaded.svg"></iframe>\n',
    );
    expect(codes("doc.md", 1)).toEqual([]);
  });

  it("checks but does not count an image whose definition sits in a raw html block", () => {
    write("diagrams/d.svg", drawn);
    write("doc.md", "<pre>\n[x]: diagrams/d.svg\n</pre>\n\n![x]\n");
    expect(codes("doc.md", 1)).toEqual(["no-diagram"]);
    expect(findImageRefs("<pre>\n[x]: diagrams/d.svg\n</pre>\n\n![x]")).toEqual([
      { alt: "x", path: "diagrams/d.svg", uncertain: true },
    ]);
  });

  it("checks but does not count images after a comment that is never closed", () => {
    write("diagrams/d.svg", drawn);
    write(
      "doc.md",
      "<!-- 古いメモ\n\n![流れ](diagrams/d.svg)\n![外部](https://example.com/a.png)\n",
    );
    expect(codes("doc.md", 1)).toEqual(["external-image", "no-diagram"]);
  });

  it("does not count images that a reader never sees", () => {
    write("diagrams/d.svg", drawn);
    write(
      "doc.md",
      [
        "<!-- ![古い図](diagrams/d.svg) -->",
        "<!--",
        "![古い図](diagrams/d.svg)",
        "-->",
        "画像は `![図](diagrams/d.svg)` のように埋め込む。",
        "``![図](diagrams/d.svg)``",
      ].join("\n"),
    );
    expect(codes("doc.md", 1)).toEqual(["no-diagram"]);
  });

  it("still sees an image between two stray backquotes in different paragraphs", () => {
    write("diagrams/d.svg", drawn);
    write("doc.md", "記号 ` の説明。\n\n![流れ](diagrams/d.svg)\n\nもう一つの ` 記号。");
    expect(codes("doc.md", 1)).toEqual([]);
  });

  it("requires the minimum number of diagrams", () => {
    write("doc.md", "# 文章だけ");
    expect(codes("doc.md", 1)).toEqual(["no-diagram"]);
  });

  it("checks other images for existence only", () => {
    write("doc.md", "![画面](shot.png)\n![ない](none.png)");
    write("shot.png", "png");
    expect(codes()).toEqual(["missing-image"]);
  });

  it("reports an unreadable document instead of throwing", () => {
    const report = checkMarkdown(path.join(dir, "absent.md"), { minDiagrams: 0 });
    expect(report.pass).toBe(false);
    expect(report.violations[0]?.code).toBe("unreadable");
  });
});

describe("runCli", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "focus-cli-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function record(scope: string) {
    const recordDir = path.join(dir, "aidlc/spaces/default/intents/261008-x");
    mkdirSync(path.join(recordDir, "inception/requirements-analysis/diagrams"), {
      recursive: true,
    });
    writeFileSync(path.join(recordDir, "aidlc-state.md"), `# State\n\n- **Scope**: ${scope}\n`);
    writeFileSync(path.join(dir, "aidlc/spaces/default/intents/active-intent"), "261008-x\n");
    return recordDir;
  }

  it("prints usage for anything but the sensor", async () => {
    for (const argv of [["paint"], ["render", "flow.json"], ["check", "doc.md"], []]) {
      const out = io(dir);
      expect(await runCli(argv, out)).toBe(2);
      expect(out.err.join("")).toContain("--output-path");
    }
  });

  it("skips the sensor outside the focus-flow scope", async () => {
    const recordDir = record("classic");
    const file = path.join(recordDir, "inception/requirements-analysis/requirements.md");
    writeFileSync(file, "図なし");
    const out = io(dir);
    expect(
      await runCli(["sensor", "--stage", "requirements-analysis", "--output-path", file], out),
    ).toBe(0);
    expect(JSON.parse(out.out.join(""))).toMatchObject({ pass: true });
  });

  it("requires a diagram in a key artifact under focus-flow", async () => {
    const recordDir = record("focus-flow");
    const file = path.join(recordDir, "inception/requirements-analysis/requirements.md");
    writeFileSync(file, "図なし");
    const out = io(dir);
    expect(
      await runCli(["sensor", "--stage", "requirements-analysis", "--output-path", file], out),
    ).toBe(0);
    const verdict = JSON.parse(out.out.join(""));
    expect(verdict.pass).toBe(false);
    expect(verdict.violations[0].code).toBe("no-diagram");
  });

  it("reports the usage problem as a failing verdict when the output path is missing", async () => {
    const out = io(dir);
    expect(await runCli(["sensor", "--stage", "requirements-analysis"], out)).toBe(0);
    expect(JSON.parse(out.out.join(""))).toMatchObject({
      pass: false,
      violations: [{ code: "usage" }],
    });
  });

  it("does not require a diagram in a questions file", async () => {
    const recordDir = record("focus-flow");
    const file = path.join(
      recordDir,
      "inception/requirements-analysis/requirements-analysis-questions.md",
    );
    writeFileSync(file, "質問だけ");
    const out = io(dir);
    await runCli(["sensor", "--stage", "requirements-analysis", "--output-path", file], out);
    expect(JSON.parse(out.out.join("")).pass).toBe(true);
  });

  it("requires a diagram in the test confirmation, checked by firing the sensor by hand", async () => {
    const recordDir = record("focus-flow");
    const folder = path.join(recordDir, "construction/u1/focus-implement");
    mkdirSync(folder, { recursive: true });
    const file = path.join(folder, "focus-implement-questions.md");
    writeFileSync(file, "質問だけ");
    const out = io(dir);
    await runCli(["--stage", "focus-implement", "--output-path", file], out);
    expect(JSON.parse(out.out.join("")).violations[0].code).toBe("no-diagram");
  });

  it("runs as a sensor when the engine passes only its fire flags", async () => {
    const recordDir = record("focus-flow");
    const file = path.join(recordDir, "inception/requirements-analysis/requirements.md");
    writeFileSync(file, "図なし");
    const out = io(dir);
    expect(await runCli(["--stage", "requirements-analysis", "--output-path", file], out)).toBe(0);
    expect(JSON.parse(out.out.join("")).violations[0].code).toBe("no-diagram");
  });

  it("resolves the scope of space-level codebase notes through the active intent", async () => {
    record("focus-flow");
    const codekb = path.join(dir, "aidlc/spaces/default/codekb/repo");
    mkdirSync(codekb, { recursive: true });
    const file = path.join(codekb, "architecture.md");
    writeFileSync(file, "![既存の構成](diagrams/missing.svg)");
    const out = io(dir);
    await runCli(["sensor", "--stage", "reverse-engineering", "--output-path", file], out);
    const verdict = JSON.parse(out.out.join(""));
    expect(verdict.pass).toBe(false);
    expect(verdict.violations[0].code).toBe("missing-image");
  });

  it("does not require a diagram in codebase notes", async () => {
    record("focus-flow");
    const codekb = path.join(dir, "aidlc/spaces/default/codekb/repo");
    mkdirSync(codekb, { recursive: true });
    const file = path.join(codekb, "architecture.md");
    writeFileSync(file, "図なし");
    const out = io(dir);
    await runCli(["sensor", "--stage", "reverse-engineering", "--output-path", file], out);
    expect(JSON.parse(out.out.join("")).pass).toBe(true);
  });
});

describe("sensor entry", () => {
  const entry = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../tools/aidlc-sensor-focus-diagrams.ts",
  );
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "focus-entry-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function requirements(): string {
    const recordDir = path.join(dir, "aidlc/spaces/default/intents/261008-x");
    const folder = path.join(recordDir, "inception/requirements-analysis");
    mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(recordDir, "aidlc-state.md"), "# State\n\n- **Scope**: focus-flow\n");
    const file = path.join(folder, "requirements.md");
    writeFileSync(file, "図なし");
    return file;
  }

  it("exports main(argv) for the native engine, which imports the entry instead of running it", async () => {
    // The native `aidlc` binary runs a plugin sensor as `aidlc engine __sensor-script-file <id>`:
    // it imports this file and calls main() with the fire flags, with no bun on the machine.
    const file = requirements();
    const written: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    try {
      const mod = (await import(entry)) as { main?: (argv: string[]) => Promise<void> };
      // Importing alone runs nothing.
      expect(written).toEqual([]);
      expect(typeof mod.main).toBe("function");
      await mod.main?.(["--stage", "requirements-analysis", "--output-path", file]);
    } finally {
      spy.mockRestore();
    }
    const verdict = JSON.parse(written.join(""));
    expect(verdict.violations[0].code).toBe("no-diagram");
  });

  it("answers the engine's sensor contract when run as a script", () => {
    const file = requirements();
    const result = spawnSync(
      "bun",
      [entry, "--stage", "requirements-analysis", "--output-path", file],
      { cwd: dir, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    const verdict = JSON.parse(result.stdout);
    expect(verdict.pass).toBe(false);
    expect(verdict.violations[0].code).toBe("no-diagram");
  });
});
