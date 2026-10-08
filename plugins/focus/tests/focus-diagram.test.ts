import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkMarkdown,
  compareStatuses,
  findImageRefs,
  layoutGraph,
  matrixCoverage,
  parseSpec,
  renderSvg,
  runCli,
  textWidth,
  wrapLabel,
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

const chain = {
  type: "graph",
  title: "注文の流れ",
  nodes: [
    { id: "ui", label: "画面" },
    { id: "api", label: "API" },
    { id: "db", label: "データベース", kind: "store" },
  ],
  edges: [
    { from: "ui", to: "api", label: "送信" },
    { from: "api", to: "db" },
  ],
};

function graph(spec: unknown) {
  const parsed = parseSpec(spec);
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  return parsed.value;
}

describe("parseSpec", () => {
  it("rejects input that is not a diagram", () => {
    expect(parseSpec(null)).toEqual({
      ok: false,
      errors: [expect.stringContaining("オブジェクト")],
    });
    const unknown = parseSpec({ type: "pie" });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.errors[0]).toContain("graph・compare・matrix");
  });

  it("rejects text that cannot appear in an SVG", () => {
    const result = parseSpec({
      type: "graph",
      title: "題\u0001",
      nodes: [
        { id: "a", label: "A\u0008" },
        { id: "b", label: "B\uD800" },
        { id: "c", label: "改行\nと\tタブ" },
      ],
      edges: [{ from: "a", to: "b", label: "￿" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const text = result.errors.join("\n");
    for (const where of ["title", "nodes[0].label", "nodes[1].label", "edges[0].label"])
      expect(text).toContain(`${where} に`);
    expect(text).not.toContain("nodes[2]");
  });

  it("rejects broken nodes and edges with their location", () => {
    const result = parseSpec({
      type: "graph",
      nodes: [
        { id: "a", label: "A" },
        { id: "a", label: "duplicate" },
        { id: "bad id", label: "B" },
        { id: "c", label: "" },
        { id: "d", label: "D", kind: "cloud" },
      ],
      edges: [{ from: "a", to: "missing" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const text = result.errors.join("\n");
    expect(text).toContain("nodes[1].id");
    expect(text).toContain("nodes[2].id");
    expect(text).toContain("nodes[3].label");
    expect(text).toContain("nodes[4].kind");
    expect(text).toContain("edges[0].to");
  });

  it("rejects a second edge between the same two nodes", () => {
    const result = parseSpec({
      type: "compare",
      asIs: {
        nodes: [
          { id: "api", label: "API" },
          { id: "db", label: "DB" },
        ],
        edges: [
          { from: "api", to: "db", label: "read" },
          { from: "api", to: "db", label: "write" },
          { from: "db", to: "api", label: "通知" },
        ],
      },
      toBe: { nodes: [{ id: "api", label: "API" }] },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([expect.stringContaining("asIs.edges[1]")]);
    expect(result.errors[0]).toContain("asIs.edges[0]");
  });

  it("rejects graphs that are too large to read", () => {
    const nodes = Array.from({ length: 81 }, (_, i) => ({ id: `n${i}`, label: `N${i}` }));
    const result = parseSpec({ type: "graph", nodes, edges: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("80");
  });

  it("rejects a comparison with nothing on either side", () => {
    const result = parseSpec({
      type: "compare",
      asIs: { nodes: [], edges: [] },
      toBe: { nodes: [], edges: [] },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects matrix links to unknown rows or columns", () => {
    const result = parseSpec({
      type: "matrix",
      rows: [{ id: "FR-1", label: "検索できる" }],
      columns: [{ id: "T-1", label: "検索のテスト" }],
      links: [["FR-9", "T-1"], ["FR-1", "T-9"], ["FR-1"]],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const text = result.errors.join("\n");
    expect(text).toContain("links[0]");
    expect(text).toContain("links[1]");
    expect(text).toContain("links[2]");
  });

  it("accepts a valid graph and applies defaults", () => {
    const spec = graph({ type: "graph", nodes: [{ id: "a", label: "A" }] });
    expect(spec).toMatchObject({ type: "graph", direction: "LR", edges: [] });
  });
});

describe("wrapLabel", () => {
  it("keeps short labels on one line", () => {
    expect(wrapLabel("API", 168)).toEqual(["API"]);
  });

  it("wraps long Japanese labels without losing characters", () => {
    const label = "会員一覧の検索条件に退会済みの会員を含めるかどうかを判定する処理";
    const lines = wrapLabel(label, 168);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe(label);
  });

  it("does not split ASCII words when a space is available", () => {
    const lines = wrapLabel("customization engine adapter module", 120);
    expect(lines.every((line) => !line.startsWith(" "))).toBe(true);
    expect(lines.join(" ")).toBe("customization engine adapter module");
  });

  it("keeps runs of spaces inside a line", () => {
    expect(wrapLabel("bun run  check", 300)).toEqual(["bun run  check"]);
  });

  it("honours explicit line breaks", () => {
    expect(wrapLabel("上段\n下段", 168)).toEqual(["上段", "下段"]);
  });
});

describe("layoutGraph", () => {
  it("places a chain in successive layers from left to right", () => {
    const spec = graph(chain);
    if (spec.type !== "graph") throw new Error("graph expected");
    const layout = layoutGraph(spec.nodes, spec.edges, "LR");
    const ui = layout.boxes.get("ui")!;
    const api = layout.boxes.get("api")!;
    const db = layout.boxes.get("db")!;
    expect(ui.x).toBeLessThan(api.x);
    expect(api.x).toBeLessThan(db.x);
    expect(layout.layers).toEqual([["ui"], ["api"], ["db"]]);
  });

  it("stacks layers from top to bottom for TB", () => {
    const spec = graph({ ...chain, direction: "TB" });
    if (spec.type !== "graph") throw new Error("graph expected");
    const layout = layoutGraph(spec.nodes, spec.edges, "TB");
    expect(layout.boxes.get("ui")!.y).toBeLessThan(layout.boxes.get("api")!.y);
  });

  it("terminates on cycles and still places every node", () => {
    const spec = graph({
      type: "graph",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "a" },
      ],
    });
    if (spec.type !== "graph") throw new Error("graph expected");
    const layout = layoutGraph(spec.nodes, spec.edges, "LR");
    expect([...layout.boxes.keys()].sort()).toEqual(["a", "b", "c"]);
    // The edge that closes the cycle is drawn but ignored for layering.
    expect(layout.layers).toEqual([["a"], ["b"], ["c"]]);
  });

  it("routes an edge that skips layers around the boxes in between", () => {
    const spec = graph({
      type: "graph",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "a", to: "c" },
      ],
    });
    if (spec.type !== "graph") throw new Error("graph expected");
    const layout = layoutGraph(spec.nodes, spec.edges, "LR");
    const long = spec.edges[2]!;
    const points = layout.routes.get(long) ?? [];
    expect(points.length).toBe(1);
    const middle = layout.boxes.get("b")!;
    const [, y] = points[0]!;
    expect(y < middle.y || y > middle.y + middle.height).toBe(true);
    expect(layout.layers).toEqual([["a"], ["b"], ["c"]]);
  });

  it("widens the gap between layers to fit edge labels", () => {
    const spec = graph({
      type: "graph",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      edges: [{ from: "a", to: "b", label: "GET /members?query=name&status=active" }],
    });
    if (spec.type !== "graph") throw new Error("graph expected");
    const layout = layoutGraph(spec.nodes, spec.edges, "LR");
    const a = layout.boxes.get("a")!;
    const b = layout.boxes.get("b")!;
    expect(b.x - (a.x + a.width)).toBeGreaterThanOrEqual(
      textWidth("GET /members?query=name&status=active") + 32,
    );
  });

  it("keeps the standard gap in a top-down flow, where a label sits across the line", () => {
    const spec = graph({
      type: "graph",
      direction: "TB",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      edges: [{ from: "a", to: "b", label: "GET /members?query=name&status=active" }],
    });
    if (spec.type !== "graph") throw new Error("graph expected");
    const layout = layoutGraph(spec.nodes, spec.edges, "TB");
    const a = layout.boxes.get("a")!;
    expect(layout.boxes.get("b")!.y - (a.y + a.height)).toBe(72);
  });

  it("never overlaps boxes in the same layer", () => {
    const spec = graph({
      type: "graph",
      nodes: [
        { id: "root", label: "起点" },
        { id: "x", label: "長いラベルを持つノードで高さが増える場合の確認" },
        { id: "y", label: "Y" },
        { id: "z", label: "Z" },
      ],
      edges: [
        { from: "root", to: "x" },
        { from: "root", to: "y" },
        { from: "root", to: "z" },
      ],
    });
    if (spec.type !== "graph") throw new Error("graph expected");
    const layout = layoutGraph(spec.nodes, spec.edges, "LR");
    const column = ["x", "y", "z"].map((id) => layout.boxes.get(id)!).sort((a, b) => a.y - b.y);
    for (let i = 1; i < column.length; i++) {
      expect(column[i]!.y).toBeGreaterThanOrEqual(column[i - 1]!.y + column[i - 1]!.height);
    }
  });
});

describe("renderSvg", () => {
  it("escapes labels and stays deterministic", () => {
    const spec = graph({
      type: "graph",
      title: "A & B <C>",
      nodes: [{ id: "a", label: 'x < y & "z"' }],
    });
    const svg = renderSvg(spec);
    expect(svg).toContain("A &amp; B &lt;C&gt;");
    expect(svg).toContain("x &lt; y &amp; &quot;z&quot;");
    expect(svg).not.toContain('"z"<');
    expect(renderSvg(spec)).toBe(svg);
  });

  it("is a self-contained accessible image with an explicit background", () => {
    const svg = renderSvg(graph(chain));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('role="img"');
    expect(svg).toContain("<title");
    expect(svg).toContain("<desc");
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain("marker");
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });

  it.each(["LR", "TB"])("keeps a wide label on a back edge off the boxes (%s)", (direction) => {
    const svg = renderSvg(
      graph({
        type: "graph",
        direction,
        nodes: [
          { id: "a", label: "受付" },
          { id: "b", label: "審査" },
          { id: "c", label: "承認" },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "c" },
          { from: "c", to: "a", label: "差し戻して確認し直す理由を書いた長い説明" },
        ],
      }),
    );
    const rects = (pattern: RegExp) =>
      [...svg.matchAll(pattern)].map((m) => ({
        x: Number(m[1]),
        y: Number(m[2]),
        w: Number(m[3]),
        h: Number(m[4]),
      }));
    const number = "(-?[\\d.]+)";
    const boxes = rects(
      new RegExp(
        `<rect x="${number}" y="${number}" width="${number}" height="${number}" rx="8"`,
        "g",
      ),
    );
    const [label] = rects(
      new RegExp(
        `<rect x="${number}" y="${number}" width="${number}" height="${number}" rx="4"`,
        "g",
      ),
    );
    expect(boxes).toHaveLength(3);
    expect(label).toBeDefined();
    for (const box of boxes) {
      const apart =
        label!.x + label!.w <= box.x ||
        box.x + box.w <= label!.x ||
        label!.y + label!.h <= box.y ||
        box.y + box.h <= label!.y;
      expect(apart).toBe(true);
    }
  });

  describe("keeps every box, line and label inside the image", () => {
    const pair = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ];
    const wide = "差し戻して確認し直す理由を書いた長い説明";
    const cases: Record<string, unknown> = {
      "a loop for a back edge": {
        type: "graph",
        nodes: pair,
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "a" },
        ],
      },
      "a label wider than the nodes in a top-down flow": {
        type: "graph",
        direction: "TB",
        nodes: pair,
        edges: [{ from: "a", to: "b", label: "長".repeat(40) }],
      },
      "a wide label on a back edge in a top-down flow": {
        type: "graph",
        direction: "TB",
        nodes: pair,
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "a", label: wide },
        ],
      },
      "a wide label on a back edge in a left-to-right flow": {
        type: "graph",
        nodes: pair,
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "a", label: wide },
        ],
      },
      "wide labels on both sides of a top-down comparison": {
        type: "compare",
        direction: "TB",
        asIs: { nodes: pair, edges: [{ from: "a", to: "b", label: "長".repeat(40) }] },
        toBe: { nodes: pair, edges: [{ from: "a", to: "b", label: "短".repeat(40) }] },
      },
    };
    it.each(Object.entries(cases))("%s", (_, spec) => {
      const svg = renderSvg(graph(spec));
      const width = Number(/<svg[^>]*\bwidth="(\d+)"/.exec(svg)?.[1]);
      const height = Number(/<svg[^>]*\bheight="(\d+)"/.exec(svg)?.[1]);
      const xs: number[] = [];
      const ys: number[] = [];
      for (const rect of svg.matchAll(
        /<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g,
      )) {
        xs.push(Number(rect[1]), Number(rect[1]) + Number(rect[3]));
        ys.push(Number(rect[2]), Number(rect[2]) + Number(rect[4]));
      }
      for (const path of svg.matchAll(/<path d="([^"]+)"/g))
        for (const point of (path[1] ?? "").matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)) {
          xs.push(Number(point[1]));
          ys.push(Number(point[2]));
        }
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...xs)).toBeLessThanOrEqual(width);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ys)).toBeLessThanOrEqual(height);
    });
  });

  it("widens the image to fit a long title", () => {
    const title = "会員一覧の検索条件に退会済みの会員を含めるかどうかを決める処理の全体像";
    const specs = [
      { type: "graph", title, nodes: [{ id: "a", label: "A" }] },
      {
        type: "matrix",
        title,
        rows: [{ id: "FR-1", label: "r" }],
        columns: [{ id: "T-1", label: "t" }],
        links: [["FR-1", "T-1"]],
      },
    ];
    for (const spec of specs) {
      const width = Number(/<svg[^>]*\bwidth="(\d+)"/.exec(renderSvg(graph(spec)))?.[1]);
      expect(width).toBeGreaterThanOrEqual((textWidth(title) * 16) / 14 + 48);
    }
  });

  it("shows symbols and a legend only when statuses are present", () => {
    expect(renderSvg(graph(chain))).not.toContain("凡例");
    const svg = renderSvg(
      graph({
        type: "graph",
        nodes: [
          { id: "a", label: "残る", status: "unchanged" },
          { id: "b", label: "新しい", status: "added" },
          { id: "c", label: "変わる", status: "changed" },
          { id: "d", label: "消える", status: "removed" },
        ],
      }),
    );
    expect(svg).toContain("凡例");
    for (const word of ["＋ 新しい", "△ 変わる", "－ 消える", "追加", "変更", "削除"])
      expect(svg).toContain(word);
  });

  it("preserves spaces in rendered text", () => {
    const svg = renderSvg(graph({ type: "graph", nodes: [{ id: "a", label: "a  b" }] }));
    expect(svg).toContain("a  b");
    expect(svg).toContain("white-space:pre");
  });

  it("wraps long labels into several text lines", () => {
    const svg = renderSvg(
      graph({
        type: "graph",
        nodes: [{ id: "a", label: "会員一覧の検索条件に退会済みの会員を含めるかを判定する" }],
      }),
    );
    expect((svg.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
  });
});

describe("compare", () => {
  const spec = {
    type: "compare",
    title: "会員検索の変更",
    asIs: {
      nodes: [
        { id: "ui", label: "一覧画面" },
        { id: "api", label: "一覧API" },
        { id: "old", label: "旧フィルタ" },
      ],
      edges: [
        { from: "ui", to: "api" },
        { from: "api", to: "old" },
      ],
    },
    toBe: {
      nodes: [
        { id: "ui", label: "一覧画面" },
        { id: "api", label: "検索API" },
        { id: "filter", label: "状態フィルタ" },
      ],
      edges: [
        { from: "ui", to: "api" },
        { from: "api", to: "filter" },
      ],
    },
  };

  it("derives added, changed and removed elements", () => {
    const parsed = graph(spec);
    if (parsed.type !== "compare") throw new Error("compare expected");
    const result = compareStatuses(parsed.asIs, parsed.toBe);
    expect(result.toBe.get("filter")).toBe("added");
    expect(result.toBe.get("api")).toBe("changed");
    expect(result.toBe.get("ui")).toBe("unchanged");
    expect(result.asIs.get("old")).toBe("removed");
    expect(result.addedEdges).toEqual(["api->filter"]);
    expect(result.removedEdges).toEqual(["api->old"]);
    expect(result.changedEdges).toEqual([]);
    expect(result.summary).toEqual({ added: 1, changed: 1, removed: 1 });
  });

  it("treats a changed kind as a change and reports relabelled edges", () => {
    const parsed = graph({
      type: "compare",
      asIs: {
        nodes: [
          { id: "api", label: "API" },
          { id: "db", label: "会員DB", kind: "store" },
        ],
        edges: [{ from: "api", to: "db", label: "read" }],
      },
      toBe: {
        nodes: [
          { id: "api", label: "API" },
          { id: "db", label: "会員DB", kind: "external" },
        ],
        edges: [{ from: "api", to: "db", label: "write" }],
      },
    });
    if (parsed.type !== "compare") throw new Error("compare expected");
    const result = compareStatuses(parsed.asIs, parsed.toBe);
    expect(result.toBe.get("db")).toBe("changed");
    expect(result.changedEdges).toEqual(["api->db"]);
    expect(result.edgeSummary).toEqual({ added: 0, changed: 1, removed: 0 });
    const svg = renderSvg(parsed);
    expect(svg).toContain("△ write");
    expect(svg).toContain("矢印 追加 0・変更 1・削除 0");
  });

  it("stacks the sides for left-to-right flows and sets them side by side for top-down flows", () => {
    const heading = (svg: string, text: string) => {
      const match = new RegExp(`<text x="(\\d+)" y="(\\d+)" class="heading">${text}`).exec(svg);
      if (!match) throw new Error(`heading ${text} not found`);
      return { x: Number(match[1]), y: Number(match[2]) };
    };
    const stacked = renderSvg(graph(spec));
    expect(heading(stacked, "To-Be（変更後）").y).toBeGreaterThan(
      heading(stacked, "As-Is（現状）").y,
    );
    expect(heading(stacked, "To-Be（変更後）").x).toBe(heading(stacked, "As-Is（現状）").x);
    const sideBySide = renderSvg(graph({ ...spec, direction: "TB" }));
    expect(heading(sideBySide, "To-Be（変更後）").x).toBeGreaterThan(
      heading(sideBySide, "As-Is（現状）").x,
    );
  });

  it("widens the image to fit the summary and every heading", () => {
    const heading = (svg: string, text: string) =>
      Number(new RegExp(`<text x="(\\d+)" y="\\d+" class="heading">${text}`).exec(svg)?.[1]);
    const widthOf = (svg: string) => Number(/<svg[^>]*\bwidth="(\d+)"/.exec(svg)?.[1]);
    const headingWidth = (text: string) => (textWidth(text) * 16) / 14;
    const one = { nodes: [{ id: "a", label: "A" }] };
    const small = renderSvg(graph({ type: "compare", asIs: one, toBe: one }));
    const summary = /class="muted">(要素[^<]+)</.exec(small)?.[1] ?? "";
    expect(summary).toContain("矢印");
    expect(widthOf(small)).toBeGreaterThanOrEqual(textWidth(summary) + 48);

    const title = "会員一覧の検索条件に退会済みの会員を含めるかどうかの変更";
    const asIsTitle = "現在の会員一覧画面と一覧取得APIの構成";
    const toBeTitle = "変更後の会員一覧画面と検索APIと状態フィルタの構成";
    for (const direction of ["LR", "TB"]) {
      const svg = renderSvg(
        graph({
          type: "compare",
          direction,
          title,
          asIs: { ...one, title: asIsTitle },
          toBe: { ...one, title: toBeTitle },
        }),
      );
      const width = widthOf(svg);
      expect(width).toBeGreaterThanOrEqual(headingWidth(title) + 48);
      expect(width).toBeGreaterThanOrEqual(heading(svg, toBeTitle) + headingWidth(toBeTitle) + 24);
      if (direction === "TB")
        expect(heading(svg, toBeTitle)).toBeGreaterThan(
          heading(svg, asIsTitle) + headingWidth(asIsTitle),
        );
    }
  });

  it("renders both sides with a summary", () => {
    const svg = renderSvg(graph(spec));
    expect(svg).toContain("As-Is（現状）");
    expect(svg).toContain("To-Be（変更後）");
    expect(svg).toContain("追加 1・変更 1・削除 1");
  });
});

describe("matrix", () => {
  const spec = {
    type: "matrix",
    title: "要件とテスト",
    rows: [
      { id: "FR-1", label: "名前で検索できる" },
      { id: "FR-2", label: "退会済みを除外する" },
    ],
    columns: [
      { id: "T-1", label: "名前検索" },
      { id: "T-2", label: "どの要件にも対応しないテスト" },
    ],
    links: [["FR-1", "T-1"]],
  };

  it("finds requirements without tests and tests without requirements", () => {
    const parsed = graph(spec);
    if (parsed.type !== "matrix") throw new Error("matrix expected");
    expect(matrixCoverage(parsed)).toEqual({ uncoveredRows: ["FR-2"], orphanColumns: ["T-2"] });
  });

  it("widens the image to fit the warning about tests without requirements", () => {
    const svg = renderSvg(
      graph({
        type: "matrix",
        columnHeader: "受け入れテストケース",
        rows: [{ id: "FR-1", label: "r" }],
        columns: ["T-1", "T-2", "T-3", "T-4"].map((id) => ({ id, label: "t" })),
        links: [],
      }),
    );
    const width = Number(/width="(\d+)"/.exec(svg)?.[1]);
    const warning = /<text[^>]*style="fill:#b45309">([^<]+)<\/text>/.exec(svg)?.[1] ?? "";
    expect(warning).toContain("T-4");
    expect(width).toBeGreaterThanOrEqual(textWidth(warning) + 48);
  });

  it("marks the gaps in the image", () => {
    const svg = renderSvg(graph(spec));
    expect(svg).toContain("未対応");
    expect(svg).toContain("✔");
    expect(svg).toContain("要件 2 件中 1 件にテストあり");
    expect(svg).toContain("T-2");
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
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    write(
      "doc.md",
      "![流れ](diagrams/d.svg)\n![画面][shot]\n\n[shot]: https://example.com/a.png\n",
    );
    expect(codes("doc.md", 1)).toEqual(["external-image"]);
  });

  it("reports a malformed percent escape instead of throwing", () => {
    write("doc.md", "![壊れた](diagrams/100%.svg)\n![外側](../a.svg)");
    expect(codes()).toEqual(["invalid-path", "outside-path"]);
  });

  it("reports missing images, missing sources, broken sources and stale images", () => {
    write(
      "doc.md",
      "![a](diagrams/a.svg)\n![b](diagrams/b.svg)\n![c](diagrams/c.svg)\n![d](diagrams/d.svg)",
    );
    write("diagrams/b.svg", "<svg/>");
    write("diagrams/c.svg", "<svg/>");
    write("diagrams/c.json", '{"type":"pie"}');
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", "<svg>old</svg>");
    expect(codes()).toEqual(["missing-image", "missing-source", "invalid-source", "stale-image"]);
  });

  it("passes when every diagram is up to date and counts them", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    write("doc.md", "# 設計\n\n![流れ](diagrams/d.svg)\n");
    const report = checkMarkdown(path.join(dir, "doc.md"), { minDiagrams: 1 });
    expect(report).toEqual({ pass: true, diagrams: 1, violations: [] });
  });

  it("accepts images whose line endings differ from the rendering", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)).replace(/\n/g, "\r\n"));
    write("doc.md", "![流れ](diagrams/d.svg)");
    expect(codes()).toEqual([]);
  });

  it("does not count images that a reader never sees", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
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
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
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

  it("prints usage for an unknown command", async () => {
    const out = io(dir);
    expect(await runCli(["paint"], out)).toBe(2);
    expect(out.err.join("")).toContain("render");
  });

  it("renders a source next to itself and reports invalid sources", async () => {
    writeFileSync(path.join(dir, "flow.json"), JSON.stringify(chain));
    const out = io(dir);
    expect(await runCli(["render", "flow.json"], out)).toBe(0);
    expect(readFileSync(path.join(dir, "flow.svg"), "utf8")).toBe(renderSvg(graph(chain)));

    writeFileSync(path.join(dir, "bad.json"), "{");
    const bad = io(dir);
    expect(await runCli(["render", "bad.json"], bad)).toBe(1);
    expect(bad.err.join("")).toContain("JSON");
  });

  it("returns a failing exit code when a document fails the check", async () => {
    writeFileSync(path.join(dir, "doc.md"), "本文だけ");
    const out = io(dir);
    expect(await runCli(["check", "doc.md", "--min", "1"], out)).toBe(1);
    expect(JSON.parse(out.out.join("")).violations[0].code).toBe("no-diagram");
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

  it("runs as a sensor when the engine passes only its fire flags", async () => {
    const recordDir = record("focus-flow");
    const file = path.join(recordDir, "inception/requirements-analysis/requirements.md");
    writeFileSync(file, "図なし");
    const out = io(dir);
    expect(await runCli(["--stage", "requirements-analysis", "--output-path", file], out)).toBe(0);
    expect(JSON.parse(out.out.join("")).violations[0].code).toBe("no-diagram");
  });

  it("answers the engine's sensor contract from the aidlc-sensor entry file", () => {
    const recordDir = record("focus-flow");
    const file = path.join(recordDir, "inception/requirements-analysis/requirements.md");
    writeFileSync(file, "図なし");
    const entry = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../tools/aidlc-sensor-focus-diagrams.ts",
    );
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
