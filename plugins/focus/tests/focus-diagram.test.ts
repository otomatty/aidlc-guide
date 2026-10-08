import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

  it("rejects line breaks and tabs in text drawn on one line", () => {
    const result = parseSpec({
      type: "graph",
      title: "上\n下",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "複数行の\nノード" },
      ],
      edges: [
        { from: "a", to: "b", label: "差し\n戻し" },
        { from: "b", to: "a", label: "x\ty" },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      expect.stringContaining("title"),
      expect.stringContaining("edges[0].label"),
      expect.stringContaining("edges[1].label"),
    ]);
    for (const error of result.errors) expect(error).toContain("1 行");
  });

  it("rejects line breaks in matrix column labels, which are drawn on one line", () => {
    const result = parseSpec({
      type: "matrix",
      rows: [{ id: "FR-1", label: "複数行の\n要件" }],
      columns: [{ id: "T-1", label: "検索の\nテスト" }],
      links: [["FR-1", "T-1"]],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([expect.stringContaining("columns[0].label")]);
    expect(result.errors[0]).toContain("1 行");
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
  it("draws a tab as the space it is measured as", () => {
    expect(wrapLabel("A\t\tB", 168)).toEqual(["A  B"]);
  });

  it("breaks lines at every newline form, as XML reads them", () => {
    for (const label of ["上\n下", "上\r下", "上\r\n下"])
      expect(wrapLabel(label, 168)).toEqual(["上", "下"]);
  });

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

  it.each(["LR", "TB"])(
    "curves forward edges only between layers, clear of wider siblings (%s)",
    (direction) => {
      const svg = renderSvg(
        graph({
          type: "graph",
          direction,
          nodes: [
            { id: "a", label: "A" },
            { id: "c", label: "幅も高さもある別の要素で、隣の要素より大きく描かれる" },
            { id: "b", label: "B" },
            { id: "d", label: "D" },
          ],
          edges: [
            { from: "a", to: "b" },
            { from: "a", to: "d" },
          ],
        }),
      );
      const boxes = [
        ...svg.matchAll(
          /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="8"/g,
        ),
      ].map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }));
      const curves = [...svg.matchAll(/<path d="(M[^"]+)" fill="none" stroke=/g)].map(
        (m) => m[1] ?? "",
      );
      expect(curves).toHaveLength(2);
      for (const d of curves) {
        const [start, ...rest] = [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(
          (m) => [Number(m[1]), Number(m[2])] as const,
        );
        let from = start!;
        for (let i = 0; i + 2 < rest.length; i += 3) {
          const [c1, c2, to] = [rest[i]!, rest[i + 1]!, rest[i + 2]!];
          for (let t = 0.05; t < 1; t += 0.05) {
            const u = 1 - t;
            const at = (k: 0 | 1) =>
              u * u * u * from[k] +
              3 * u * u * t * c1[k] +
              3 * u * t * t * c2[k] +
              t * t * t * to[k];
            const [x, y] = [at(0), at(1)];
            for (const b of boxes)
              expect(x > b.x + 1 && x < b.x + b.w - 1 && y > b.y + 1 && y < b.y + b.h - 1).toBe(
                false,
              );
          }
          from = to;
        }
      }
    },
  );

  it.each(["LR", "TB"])(
    "keeps a forward edge's label in the gap, off the boxes (%s)",
    (direction) => {
      const svg = renderSvg(
        graph({
          type: "graph",
          direction,
          nodes: [
            { id: "a", label: "受付" },
            { id: "b", label: "審査" },
          ],
          edges: [{ from: "a", to: "b", label: "通常" }],
        }),
      );
      const rects = (rx: number) =>
        [
          ...svg.matchAll(
            new RegExp(
              `<rect x="([\\d.]+)" y="([\\d.]+)" width="([\\d.]+)" height="([\\d.]+)" rx="${rx}"`,
              "g",
            ),
          ),
        ].map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }));
      const [label] = rects(4);
      expect(label).toBeDefined();
      for (const box of rects(8))
        expect(
          label!.x + label!.w <= box.x ||
            box.x + box.w <= label!.x ||
            label!.y + label!.h <= box.y ||
            box.y + box.h <= label!.y,
        ).toBe(true);
    },
  );

  it("explains edge-only statuses in the legend and the description", () => {
    const svg = renderSvg(
      graph({
        type: "graph",
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        edges: [{ from: "a", to: "b", status: "added" }],
      }),
    );
    expect(svg).toContain("凡例");
    expect(svg).toContain("＋ 追加");
    expect(/<desc id="desc">([^<]*)<\/desc>/.exec(svg)?.[1]).toContain("矢印 追加 1");
    const nodes = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ];
    const compared = renderSvg(
      graph({
        type: "compare",
        asIs: { nodes, edges: [] },
        toBe: { nodes, edges: [{ from: "a", to: "b" }] },
      }),
    );
    expect(compared).toContain("＋ 追加");
  });

  it.each(["LR", "TB"])("routes back edges and loops around every box (%s)", (direction) => {
    const svg = renderSvg(
      graph({
        type: "graph",
        direction,
        nodes: [
          { id: "a", label: "受付" },
          { id: "c", label: "別系統" },
          { id: "d", label: "通知" },
          { id: "b", label: "審査" },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "a", label: "差し戻し" },
          { from: "a", to: "c", label: "同じ段" },
          { from: "d", to: "d", label: "再試行" },
        ],
      }),
    );
    const boxes = [
      ...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="8"/g),
    ].map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }));
    expect(boxes).toHaveLength(4);
    // Edge paths only (not the arrowheads); forward edges are curves, routed edges straight lines.
    const polylines = [...svg.matchAll(/<path d="(M[^"]+)" fill="none" stroke=/g)]
      .map((m) => m[1] ?? "")
      .filter((d) => !d.includes("C"))
      .map((d) =>
        [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((p) => [Number(p[1]), Number(p[2])]),
      );
    // The back edge b -> a and the loop d -> d.
    expect(polylines).toHaveLength(2);
    // No straight segment of a routed edge runs through the inside of any box.
    for (const points of polylines)
      for (let i = 1; i < points.length; i++) {
        const [x1, y1] = points[i - 1]!;
        const [x2, y2] = points[i]!;
        for (const b of boxes) {
          const crossesX = Math.max(x1!, x2!) > b.x && Math.min(x1!, x2!) < b.x + b.w;
          const crossesY = Math.max(y1!, y2!) > b.y && Math.min(y1!, y2!) < b.y + b.h;
          const vertical = x1 === x2;
          const inside = vertical
            ? x1! > b.x && x1! < b.x + b.w && crossesY
            : y1! > b.y && y1! < b.y + b.h && crossesX;
          expect(inside).toBe(false);
        }
      }
  });

  it.each(["LR", "TB"])(
    "keeps a node's own loop clear of its siblings and its other edges (%s)",
    (direction) => {
      const svg = renderSvg(
        graph({
          type: "graph",
          direction,
          nodes: [
            { id: "a", label: "受付" },
            { id: "b", label: "審査" },
            { id: "s", label: "保留" },
          ],
          edges: [
            { from: "a", to: "b" },
            { from: "a", to: "s" },
            { from: "b", to: "b", label: "再試行する" },
            { from: "b", to: "a", label: "戻す" },
          ],
        }),
      );
      const number = "(-?[\\d.]+)";
      const rects = (rx: number) =>
        [
          ...svg.matchAll(
            new RegExp(
              `<rect x="${number}" y="${number}" width="${number}" height="${number}" rx="${rx}"`,
              "g",
            ),
          ),
        ].map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }));
      const boxes = rects(8);
      const labels = rects(4);
      expect(boxes).toHaveLength(3);
      expect(labels).toHaveLength(2);
      const polylines = [...svg.matchAll(/<path d="(M[^"]+)" fill="none" stroke=/g)]
        .map((m) => m[1] ?? "")
        .filter((d) => !d.includes("C"))
        .map((d) =>
          [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((p) => [Number(p[1]), Number(p[2])]),
        );
      const loop = polylines.find((points) => points.length === 4);
      const back = polylines.find((points) => points.length === 6);
      expect(loop).toBeDefined();
      expect(back).toBeDefined();
      const segments = (points: number[][]) =>
        points.slice(1).map((point, i) => [points[i]!, point] as const);
      // Straight segments meet exactly when their bounding boxes overlap.
      for (const [[x1, y1], [x2, y2]] of segments(loop!))
        for (const [[x3, y3], [x4, y4]] of segments(back!)) {
          const meet =
            Math.max(x1!, x2!) >= Math.min(x3!, x4!) &&
            Math.max(x3!, x4!) >= Math.min(x1!, x2!) &&
            Math.max(y1!, y2!) >= Math.min(y3!, y4!) &&
            Math.max(y3!, y4!) >= Math.min(y1!, y2!);
          expect(meet).toBe(false);
        }
      const apart = (r: { x: number; y: number; w: number; h: number }, b: typeof r) =>
        r.x + r.w <= b.x || b.x + b.w <= r.x || r.y + r.h <= b.y || b.y + b.h <= r.y;
      for (const label of labels) for (const box of boxes) expect(apart(label, box)).toBe(true);
      // The loop runs outside every box: its far corners lie in no box.
      for (const [x, y] of loop!.slice(1, 3))
        for (const box of boxes)
          expect(x! > box.x && x! < box.x + box.w && y! > box.y && y! < box.y + box.h).toBe(false);
    },
  );

  it.each([
    ["LR", "c"],
    ["TB", "c"],
    ["LR", "b"],
    ["TB", "b"],
  ])("keeps a wide label on a back edge off the boxes (%s, from %s)", (direction, from) => {
    // From c the edge goes back to the first box; from b it is the middle box's own loop.
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
          {
            from,
            to: from === "b" ? "b" : "a",
            label: "差し戻して確認し直す理由を書いた長い説明",
          },
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

  it("widens a narrow image to fit the whole legend", () => {
    const svg = renderSvg(
      graph({
        type: "graph",
        nodes: [
          { id: "a", label: "残", status: "unchanged" },
          { id: "b", label: "新", status: "added" },
          { id: "c", label: "変", status: "changed" },
          { id: "d", label: "消", status: "removed" },
        ],
      }),
    );
    const width = Number(/<svg[^>]*\bwidth="(\d+)"/.exec(svg)?.[1]);
    const last = /<text x="([\d.]+)" y="[\d.]+">(変更なし)<\/text>/.exec(svg);
    expect(last).not.toBeNull();
    expect(Number(last?.[1]) + textWidth(last?.[2] ?? "")).toBeLessThanOrEqual(width);
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

  it.each(["LR", "TB"])("draws an edge from a node to itself as a loop (%s)", (direction) => {
    const svg = renderSvg(
      graph({
        type: "graph",
        direction,
        nodes: [{ id: "a", label: "再試行" }],
        edges: [{ from: "a", to: "a", label: "失敗時" }],
      }),
    );
    const d = /<path d="(M[^"]+)" fill="none"/.exec(svg)?.[1] ?? "";
    const points = [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(
      (m) => `${m[1]},${m[2]}`,
    );
    expect(points).toHaveLength(4);
    expect(new Set(points).size).toBe(4);
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

  it("finds the file an address names without its fragment or query", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    write("diagrams/icons.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>');
    write(
      "doc.md",
      [
        "![流れ](diagrams/d.svg#top)",
        '<svg><use href="diagrams/icons.svg#check"></use></svg>',
        '<img src="diagrams/d.svg?v=2">',
        '<svg><use href="diagrams/none.svg#check"></use></svg>',
      ].join("\n"),
    );
    // Every local SVG needs its source, a sprite included.
    expect(codes("doc.md", 1)).toEqual(["missing-source", "missing-image"]);
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

  it("rejects an external candidate beside a valid local diagram", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    // The srcset candidate may be shown instead of the diagram, so the diagram does not count.
    write("doc.md", '<img src="diagrams/d.svg" srcset="https://example.com/remote.svg 1x">');
    expect(codes("doc.md", 1)).toEqual(["external-image", "no-diagram"]);
    write("doc.md", "![流れ](diagrams/d.svg)\n![cdn](//cdn.example.com/a.png)");
    expect(codes("doc.md", 1)).toEqual(["external-image"]);
  });

  it("counts a diagram embedded with an html image tag but not one written inside <pre>", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    write("doc.md", '<img src="diagrams/d.svg" alt="流れ">\n');
    expect(codes("doc.md", 1)).toEqual([]);
    write("doc.md", "<pre>\n![流れ](diagrams/d.svg)\n</pre>\n");
    expect(codes("doc.md", 1)).toEqual(["no-diagram"]);
  });

  it("checks images on indented lines but does not count them as diagrams", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    write("diagrams/old.json", JSON.stringify(chain));
    write("diagrams/old.svg", "<svg>old</svg>");
    write(
      "doc.md",
      [
        "例:",
        "",
        "    ![図](diagrams/d.svg)",
        "    ![古い](diagrams/old.svg)",
        "    <img src=https://example.com/a.svg>",
      ].join("\n"),
    );
    expect(codes("doc.md", 1)).toEqual(["stale-image", "external-image", "no-diagram"]);
  });

  it("does not count an image inside a code block left open at the end", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
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
    write("..d.json", JSON.stringify(chain));
    write("..d.svg", renderSvg(graph(chain)));
    write("diagrams/..e.json", JSON.stringify(chain));
    write("diagrams/..e.svg", renderSvg(graph(chain)));
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
      writeFileSync(path.join(outside, "d.json"), JSON.stringify(chain));
      writeFileSync(path.join(outside, "d.svg"), renderSvg(graph(chain)));
      // A junction needs no privileges on Windows; elsewhere it is a directory link.
      symlinkSync(outside, path.join(dir, "linked"), "junction");
      write("doc.md", "![流れ](linked/d.svg)");
      expect(codes("doc.md", 1)).toEqual(["outside-path", "no-diagram"]);
      // A link that stays inside the folder is fine.
      write("diagrams/d.json", JSON.stringify(chain));
      write("diagrams/d.svg", renderSvg(graph(chain)));
      symlinkSync(path.join(dir, "diagrams"), path.join(dir, "same"), "junction");
      write("doc.md", "![流れ](same/d.svg)");
      expect(codes("doc.md", 1)).toEqual([]);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects css or a srcdoc holding a character reference the check cannot read", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
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
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    write(
      "doc.md",
      '<img src="diagrams/d.svg" alt="See https://example.com/help" title="https://example.com/t">\n',
    );
    expect(codes("doc.md", 1)).toEqual([]);
  });

  it("checks only attributes that load something, not data-* or value", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    write(
      "doc.md",
      '<img src="diagrams/d.svg" data-doc="https://example.com/help" value="https://example.com/v">\n',
    );
    expect(codes("doc.md", 1)).toEqual([]);
  });

  it("checks an attribute only on the elements that load from it", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
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
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    write(
      "doc.md",
      '<picture><source srcset="/remote.svg 1x"><img src="diagrams/d.svg"></picture>\n',
    );
    expect(codes("doc.md", 1)).toEqual(["absolute-path", "no-diagram"]);
  });

  it("rejects a base element, which moves where every relative path loads from", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    write("doc.md", '<base href="subdir/index.html">\n\n<img src="diagrams/d.svg">\n');
    expect(codes("doc.md", 1)).toEqual(["base-element"]);
  });

  it("rejects a base element inside an iframe's srcdoc", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    mkdirSync(path.join(dir, "sub"));
    write("sub/index.html", "<p>x</p>");
    write(
      "doc.md",
      '![流れ](diagrams/d.svg)\n\n<iframe srcdoc="&lt;base href=&quot;sub/index.html&quot;&gt;&lt;img src=&quot;diagrams/d.svg&quot;&gt;"></iframe>\n',
    );
    expect(codes("doc.md", 1)).toEqual(["base-element"]);
  });

  it("does not count a diagram in a page with a style sheet that can hide it", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    write(
      "doc.md",
      '<style>.hidden{display:none}</style>\n\n<div class="hidden"><img src="diagrams/d.svg"></div>\n',
    );
    expect(codes("doc.md", 1)).toEqual(["no-diagram"]);
  });

  it("accepts an iframe whose fallback text names an external image", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    write(
      "doc.md",
      '![流れ](diagrams/d.svg)\n\n<iframe><img src="https://example.com/not-loaded.svg"></iframe>\n',
    );
    expect(codes("doc.md", 1)).toEqual([]);
  });

  it("checks but does not count an image whose definition sits in a raw html block", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    write("doc.md", "<pre>\n[x]: diagrams/d.svg\n</pre>\n\n![x]\n");
    expect(codes("doc.md", 1)).toEqual(["no-diagram"]);
    expect(findImageRefs("<pre>\n[x]: diagrams/d.svg\n</pre>\n\n![x]")).toEqual([
      { alt: "x", path: "diagrams/d.svg", uncertain: true },
    ]);
  });

  it("checks but does not count images after a comment that is never closed", () => {
    write("diagrams/d.json", JSON.stringify(chain));
    write("diagrams/d.svg", renderSvg(graph(chain)));
    write(
      "doc.md",
      "<!-- 古いメモ\n\n![流れ](diagrams/d.svg)\n![外部](https://example.com/a.png)\n",
    );
    expect(codes("doc.md", 1)).toEqual(["external-image", "no-diagram"]);
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
