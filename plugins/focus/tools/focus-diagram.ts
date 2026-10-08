// focus-diagram: renders review diagrams from JSON sources to self-contained SVG,
// and checks that Markdown documents embed up-to-date diagrams.
//
//   bun focus-diagram.ts render <source.json> [--out <image.svg>]
//   bun focus-diagram.ts check <document.md> [--min <n>]
//   bun focus-diagram.ts sensor --stage <slug> --output-path <document.md>
//
// The engine runs sensors as `bun aidlc-sensor-<id>.ts --stage … --output-path …`,
// so aidlc-sensor-focus-diagrams.ts is the manifest's entry point.
//
// The renderer is deterministic: the same source always yields the same bytes,
// so a stale image is detected by rendering its source again and comparing.
// This file is copied into <harness>/tools/ and must stay dependency-free.

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export type NodeStatus = "added" | "changed" | "removed" | "unchanged";
export type EdgeStatus = "added" | "removed" | "unchanged";
export type NodeKind = "default" | "external" | "store";
export type Direction = "LR" | "TB";
export type DiagramNode = { id: string; label: string; kind: NodeKind; status?: NodeStatus };
export type DiagramEdge = { from: string; to: string; label?: string; status?: EdgeStatus };
export type GraphPart = { title?: string; nodes: DiagramNode[]; edges: DiagramEdge[] };
export type GraphSpec = GraphPart & { type: "graph"; direction: Direction };
export type CompareSpec = {
  type: "compare";
  title?: string;
  direction: Direction;
  asIs: GraphPart;
  toBe: GraphPart;
};
export type MatrixItem = { id: string; label: string };
export type MatrixSpec = {
  type: "matrix";
  title?: string;
  rowHeader: string;
  columnHeader: string;
  rows: MatrixItem[];
  columns: MatrixItem[];
  links: Array<[string, string]>;
};
export type DiagramSpec = GraphSpec | CompareSpec | MatrixSpec;
export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const MAX_NODES = 80;
const MAX_MATRIX = 100;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const KINDS: readonly NodeKind[] = ["default", "external", "store"];
const NODE_STATUSES: readonly NodeStatus[] = ["added", "changed", "removed", "unchanged"];
const EDGE_STATUSES: readonly EdgeStatus[] = ["added", "removed", "unchanged"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalText(
  value: unknown,
  where: string,
  max: number,
  errors: string[],
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > max) {
    errors.push(`${where} は ${max} 文字以内の文字列にしてください。`);
    return undefined;
  }
  return value;
}

function requiredLabel(value: unknown, where: string, max: number, errors: string[]): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    errors.push(`${where} は 1〜${max} 文字の文字列にしてください。`);
    return "";
  }
  return value;
}

function parsePart(value: unknown, where: string, errors: string[], allowEmpty: boolean) {
  const prefix = where ? `${where}.` : "";
  if (!isRecord(value)) {
    errors.push(`${where} はオブジェクトにしてください。`);
    return { nodes: [], edges: [] } satisfies GraphPart;
  }
  const title = optionalText(value.title, `${prefix}title`, 120, errors);
  const rawNodes = value.nodes;
  const nodes: DiagramNode[] = [];
  if (!Array.isArray(rawNodes) || (!allowEmpty && rawNodes.length === 0)) {
    errors.push(`${prefix}nodes は 1 件以上の配列にしてください。`);
  } else if (rawNodes.length > MAX_NODES) {
    errors.push(`${prefix}nodes は ${MAX_NODES} 件以内にしてください。図を分けてください。`);
  } else {
    const seen = new Set<string>();
    rawNodes.forEach((raw, index) => {
      const at = `${prefix}nodes[${index}]`;
      if (!isRecord(raw)) {
        errors.push(`${at} はオブジェクトにしてください。`);
        return;
      }
      const id = raw.id;
      if (typeof id !== "string" || !ID.test(id)) {
        errors.push(`${at}.id は英数字・_・.・- からなる 64 文字以内の ID にしてください。`);
        return;
      }
      if (seen.has(id)) {
        errors.push(`${at}.id「${id}」が重複しています。`);
        return;
      }
      seen.add(id);
      const label = requiredLabel(raw.label, `${at}.label`, 200, errors);
      const kind = raw.kind === undefined ? "default" : raw.kind;
      if (!KINDS.includes(kind as NodeKind)) {
        errors.push(`${at}.kind は ${KINDS.join("・")} のいずれかにしてください。`);
        return;
      }
      const node: DiagramNode = { id, label, kind: kind as NodeKind };
      if (raw.status !== undefined) {
        if (!NODE_STATUSES.includes(raw.status as NodeStatus)) {
          errors.push(`${at}.status は ${NODE_STATUSES.join("・")} のいずれかにしてください。`);
          return;
        }
        node.status = raw.status as NodeStatus;
      }
      nodes.push(node);
    });
  }
  const ids = new Set(nodes.map((node) => node.id));
  const edges: DiagramEdge[] = [];
  const rawEdges = value.edges ?? [];
  if (!Array.isArray(rawEdges)) {
    errors.push(`${prefix}edges は配列にしてください。`);
  } else {
    rawEdges.forEach((raw, index) => {
      const at = `${prefix}edges[${index}]`;
      if (!isRecord(raw)) {
        errors.push(`${at} はオブジェクトにしてください。`);
        return;
      }
      for (const end of ["from", "to"] as const) {
        if (typeof raw[end] !== "string" || !ids.has(raw[end])) {
          errors.push(`${at}.${end} は nodes にある ID にしてください。`);
        }
      }
      const label = optionalText(raw.label, `${at}.label`, 80, errors);
      if (raw.status !== undefined && !EDGE_STATUSES.includes(raw.status as EdgeStatus)) {
        errors.push(`${at}.status は ${EDGE_STATUSES.join("・")} のいずれかにしてください。`);
      }
      if (typeof raw.from !== "string" || typeof raw.to !== "string") return;
      if (!ids.has(raw.from) || !ids.has(raw.to)) return;
      const edge: DiagramEdge = { from: raw.from, to: raw.to };
      if (label !== undefined) edge.label = label;
      if (EDGE_STATUSES.includes(raw.status as EdgeStatus)) edge.status = raw.status as EdgeStatus;
      edges.push(edge);
    });
  }
  const part: GraphPart = { nodes, edges };
  if (title !== undefined) part.title = title;
  return part;
}

function parseDirection(value: unknown, errors: string[]): Direction {
  if (value === undefined) return "LR";
  if (value === "LR" || value === "TB") return value;
  errors.push("direction は LR か TB にしてください。");
  return "LR";
}

function parseItems(value: unknown, where: string, errors: string[]): MatrixItem[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MATRIX) {
    errors.push(`${where} は 1〜${MAX_MATRIX} 件の配列にしてください。`);
    return [];
  }
  const items: MatrixItem[] = [];
  const seen = new Set<string>();
  value.forEach((raw, index) => {
    const at = `${where}[${index}]`;
    if (!isRecord(raw) || typeof raw.id !== "string" || !ID.test(raw.id)) {
      errors.push(`${at}.id は英数字・_・.・- からなる 64 文字以内の ID にしてください。`);
      return;
    }
    if (seen.has(raw.id)) {
      errors.push(`${at}.id「${raw.id}」が重複しています。`);
      return;
    }
    seen.add(raw.id);
    items.push({ id: raw.id, label: requiredLabel(raw.label, `${at}.label`, 200, errors) });
  });
  return items;
}

/** Validate an untrusted diagram source. Errors name the offending field in Japanese. */
export function parseSpec(input: unknown): Result<DiagramSpec> {
  if (!isRecord(input))
    return { ok: false, errors: ["図の元データはオブジェクトにしてください。"] };
  const errors: string[] = [];
  const title = optionalText(input.title, "title", 120, errors);
  let spec: DiagramSpec;
  if (input.type === "graph") {
    const part = parsePart(input, "", errors, false);
    spec = { type: "graph", direction: parseDirection(input.direction, errors), ...part };
  } else if (input.type === "compare") {
    const asIs = parsePart(input.asIs, "asIs", errors, true);
    const toBe = parsePart(input.toBe, "toBe", errors, true);
    if (asIs.nodes.length === 0 && toBe.nodes.length === 0) {
      errors.push("asIs と toBe のどちらかに 1 件以上の nodes を入れてください。");
    }
    spec = {
      type: "compare",
      direction: parseDirection(input.direction, errors),
      asIs,
      toBe,
    };
  } else if (input.type === "matrix") {
    const rows = parseItems(input.rows, "rows", errors);
    const columns = parseItems(input.columns, "columns", errors);
    const rowIds = new Set(rows.map((row) => row.id));
    const columnIds = new Set(columns.map((column) => column.id));
    const links: Array<[string, string]> = [];
    if (!Array.isArray(input.links)) {
      errors.push("links は [行 ID, 列 ID] の配列にしてください。");
    } else {
      input.links.forEach((raw, index) => {
        if (
          !Array.isArray(raw) ||
          raw.length !== 2 ||
          !rowIds.has(raw[0] as string) ||
          !columnIds.has(raw[1] as string)
        ) {
          errors.push(`links[${index}] は rows と columns にある ID の組にしてください。`);
          return;
        }
        links.push([raw[0] as string, raw[1] as string]);
      });
    }
    spec = {
      type: "matrix",
      rowHeader: optionalText(input.rowHeader, "rowHeader", 40, errors) ?? "要件",
      columnHeader: optionalText(input.columnHeader, "columnHeader", 40, errors) ?? "テスト",
      rows,
      columns,
      links,
    };
  } else {
    return { ok: false, errors: ["type は graph・compare・matrix のいずれかにしてください。"] };
  }
  if (errors.length) return { ok: false, errors };
  if (title !== undefined) spec.title = title;
  return { ok: true, value: spec };
}

// ---------------------------------------------------------------------------
// Text measurement and wrapping. Widths are estimates for a 14px sans-serif
// font: CJK and full-width characters take a full em, ASCII about 0.6 em.

const FONT_SIZE = 14;
const LINE_HEIGHT = 18;

function charWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code < 0x80) return /[A-Z0-9@%&#MW]/.test(char) ? 9.5 : 8;
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x2190 && code <= 0x27bf)
  )
    return FONT_SIZE;
  return 9;
}

export function textWidth(text: string): number {
  let width = 0;
  for (const char of text) width += charWidth(char);
  return width;
}

/** Split a label into lines no wider than `max`, keeping ASCII words whole when possible. */
export function wrapLabel(label: string, max: number): string[] {
  const lines: string[] = [];
  for (const paragraph of label.split("\n")) {
    const tokens = paragraph.match(/[A-Za-z0-9_.,:;!?'"()/-]+|\s+|./gu) ?? [];
    let line = "";
    for (const token of tokens) {
      if (/^\s+$/.test(token)) {
        if (line) line += " ";
        continue;
      }
      if (textWidth(line + token) <= max) {
        line += token;
        continue;
      }
      if (line.trim()) lines.push(line.trimEnd());
      line = "";
      if (textWidth(token) <= max) {
        line = token;
        continue;
      }
      for (const char of token) {
        if (textWidth(line + char) > max && line) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    if (line.trim() || lines.length === 0) lines.push(line.trimEnd());
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Layered layout: longest-path layers on the acyclic part of the graph, then
// barycentre ordering sweeps, then coordinates.

export type Box = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
};
export type Point = [number, number];
export type Layout = {
  boxes: Map<string, Box>;
  layers: string[][];
  /** Waypoints for edges that skip layers, so they pass beside the boxes in between. */
  routes: Map<DiagramEdge, Point[]>;
  width: number;
  height: number;
};

const LABEL_MAX = 168;
const PAD_X = 14;
const PAD_Y = 10;
const MIN_WIDTH = 96;
const LAYER_GAP = 72;
const SIBLING_GAP = 24;
const DUMMY_SIZE = 12;
const SYMBOL: Record<NodeStatus, string> = {
  added: "＋ ",
  changed: "△ ",
  removed: "－ ",
  unchanged: "",
};

function measure(node: DiagramNode): Omit<Box, "x" | "y"> {
  const lines = wrapLabel(node.label, LABEL_MAX);
  const symbol = node.status ? SYMBOL[node.status] : "";
  if (symbol) lines[0] = symbol + lines[0];
  const width = Math.max(MIN_WIDTH, Math.ceil(Math.max(...lines.map(textWidth)) + PAD_X * 2));
  return { id: node.id, width, height: lines.length * LINE_HEIGHT + PAD_Y * 2, lines };
}

function forwardEdges(nodes: DiagramNode[], edges: DiagramEdge[]): DiagramEdge[] {
  const out = new Map<string, DiagramEdge[]>(nodes.map((node) => [node.id, []]));
  for (const edge of edges) out.get(edge.from)?.push(edge);
  const state = new Map<string, "visiting" | "done">();
  const back = new Set<DiagramEdge>();
  const visit = (id: string) => {
    state.set(id, "visiting");
    for (const edge of out.get(id) ?? []) {
      const next = state.get(edge.to);
      if (next === "visiting") back.add(edge);
      else if (next === undefined) visit(edge.to);
    }
    state.set(id, "done");
  };
  for (const node of nodes) if (!state.has(node.id)) visit(node.id);
  return edges.filter((edge) => !back.has(edge) && edge.from !== edge.to);
}

/** Edge-label clearance between layers; a label sits in the gap it crosses. */
export function layerGap(edges: DiagramEdge[]): number {
  const widest = Math.max(0, ...edges.map((edge) => (edge.label ? textWidth(edge.label) + 8 : 0)));
  return Math.max(LAYER_GAP, Math.ceil(widest + 32));
}

export function layoutGraph(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  direction: Direction,
): Layout {
  const order = new Map(nodes.map((node, index) => [node.id, index]));
  const forward = forwardEdges(nodes, edges);
  const layer = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  // Longest path over the DAG; |nodes| relaxation passes always settle.
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const edge of forward) {
      const next = (layer.get(edge.from) ?? 0) + 1;
      if (next > (layer.get(edge.to) ?? 0)) {
        layer.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const depth = Math.max(0, ...layer.values()) + 1;
  const layers: string[][] = Array.from({ length: depth }, () => []);
  for (const node of nodes) layers[layer.get(node.id) ?? 0]!.push(node.id);

  // Split edges that skip layers into chains through placeholder slots. The
  // placeholders take part in ordering, so the edge gets its own lane.
  const segments: Array<[string, string]> = [];
  const chains = new Map<DiagramEdge, string[]>();
  forward.forEach((edge, index) => {
    const from = layer.get(edge.from) ?? 0;
    const to = layer.get(edge.to) ?? 0;
    const chain: string[] = [];
    let previous = edge.from;
    for (let at = from + 1; at < to; at++) {
      const dummy = `\u0000${index}:${at}`;
      layers[at]!.push(dummy);
      order.set(dummy, nodes.length + index);
      chain.push(dummy);
      segments.push([previous, dummy]);
      previous = dummy;
    }
    segments.push([previous, edge.to]);
    if (chain.length) chains.set(edge, chain);
  });

  const position = () => {
    const map = new Map<string, number>();
    for (const ids of layers) ids.forEach((id, index) => map.set(id, index));
    return map;
  };
  const neighbours = (id: string, upward: boolean) =>
    segments
      .filter(([from, to]) => (upward ? to === id : from === id))
      .map(([from, to]) => (upward ? from : to));
  for (let sweep = 0; sweep < 2; sweep++) {
    for (const upward of [true, false]) {
      const indices = upward
        ? layers.map((_, index) => index).slice(1)
        : layers
            .map((_, index) => index)
            .slice(0, -1)
            .reverse();
      for (const index of indices) {
        const at = position();
        const ids = layers[index]!;
        const score = (id: string) => {
          const linked = neighbours(id, upward).map((other) => at.get(other) ?? 0);
          return linked.length
            ? linked.reduce((sum, value) => sum + value, 0) / linked.length
            : (at.get(id) ?? 0);
        };
        const scores = new Map(ids.map((id) => [id, score(id)]));
        ids.sort(
          (a, b) =>
            (scores.get(a) ?? 0) - (scores.get(b) ?? 0) ||
            (order.get(a) ?? 0) - (order.get(b) ?? 0),
        );
      }
    }
  }

  const measured = new Map<string, Omit<Box, "x" | "y">>(
    nodes.map((node) => [node.id, measure(node)]),
  );
  for (const ids of layers)
    for (const id of ids)
      if (!measured.has(id))
        measured.set(id, { id, width: DUMMY_SIZE, height: DUMMY_SIZE, lines: [] });
  const placed = new Map<string, Box>();
  const horizontal = direction === "LR";
  const gap = layerGap(edges);
  const cross = (id: string) => (horizontal ? measured.get(id)!.height : measured.get(id)!.width);
  const span = (ids: string[]) =>
    ids.reduce((sum, id, index) => sum + cross(id) + (index ? SIBLING_GAP : 0), 0);
  const thickness = (ids: string[]) =>
    Math.max(
      0,
      ...ids.map((id) => (horizontal ? measured.get(id)!.width : measured.get(id)!.height)),
    );
  const crossSize = Math.max(...layers.map(span));
  let along = 0;
  for (const ids of layers) {
    const depthOfLayer = thickness(ids);
    let offset = (crossSize - span(ids)) / 2;
    for (const id of ids) {
      const box = measured.get(id)!;
      const isDummy = !order.has(id) || (order.get(id) ?? 0) >= nodes.length;
      // Placeholders sit on the layer's centre line so the lane runs straight.
      const lane = isDummy ? along + depthOfLayer / 2 - DUMMY_SIZE / 2 : along;
      const x = horizontal ? lane : offset;
      const y = horizontal ? offset : lane;
      placed.set(id, { ...box, x: Math.round(x), y: Math.round(y) });
      offset += cross(id) + SIBLING_GAP;
    }
    along += depthOfLayer + gap;
  }
  along -= gap;

  const boxes = new Map<string, Box>();
  for (const node of nodes) boxes.set(node.id, placed.get(node.id)!);
  const routes = new Map<DiagramEdge, Point[]>();
  for (const [edge, chain] of chains)
    routes.set(
      edge,
      chain.map((id) => {
        const box = placed.get(id)!;
        return [box.x + DUMMY_SIZE / 2, box.y + DUMMY_SIZE / 2] as Point;
      }),
    );
  return {
    boxes,
    layers: layers.map((ids) => ids.filter((id) => boxes.has(id))),
    routes,
    width: Math.round(horizontal ? along : crossSize),
    height: Math.round(horizontal ? crossSize : along),
  };
}

// ---------------------------------------------------------------------------
// Comparison and coverage helpers.

export type Comparison = {
  asIs: Map<string, NodeStatus>;
  toBe: Map<string, NodeStatus>;
  addedEdges: string[];
  removedEdges: string[];
  summary: { added: number; changed: number; removed: number };
};

const edgeKey = (edge: DiagramEdge) => `${edge.from}->${edge.to}`;

export function compareStatuses(asIs: GraphPart, toBe: GraphPart): Comparison {
  const before = new Map(asIs.nodes.map((node) => [node.id, node]));
  const after = new Map(toBe.nodes.map((node) => [node.id, node]));
  const toBeStatus = new Map<string, NodeStatus>();
  for (const node of toBe.nodes) {
    const prior = before.get(node.id);
    toBeStatus.set(
      node.id,
      !prior ? "added" : prior.label !== node.label ? "changed" : "unchanged",
    );
  }
  const asIsStatus = new Map<string, NodeStatus>(
    asIs.nodes.map((node) => [node.id, after.has(node.id) ? "unchanged" : "removed"]),
  );
  const beforeEdges = new Set(asIs.edges.map(edgeKey));
  const afterEdges = new Set(toBe.edges.map(edgeKey));
  const addedEdges = toBe.edges.map(edgeKey).filter((key) => !beforeEdges.has(key));
  const removedEdges = asIs.edges.map(edgeKey).filter((key) => !afterEdges.has(key));
  const count = (map: Map<string, NodeStatus>, status: NodeStatus) =>
    [...map.values()].filter((value) => value === status).length;
  return {
    asIs: asIsStatus,
    toBe: toBeStatus,
    addedEdges,
    removedEdges,
    summary: {
      added: count(toBeStatus, "added"),
      changed: count(toBeStatus, "changed"),
      removed: count(asIsStatus, "removed"),
    },
  };
}

export function matrixCoverage(spec: MatrixSpec): {
  uncoveredRows: string[];
  orphanColumns: string[];
} {
  const rows = new Set(spec.links.map(([row]) => row));
  const columns = new Set(spec.links.map(([, column]) => column));
  return {
    uncoveredRows: spec.rows.filter((row) => !rows.has(row.id)).map((row) => row.id),
    orphanColumns: spec.columns.filter((column) => !columns.has(column.id)).map((c) => c.id),
  };
}

// ---------------------------------------------------------------------------
// SVG rendering.

const MARGIN = 24;
const TITLE_HEIGHT = 32;
const FONT =
  "system-ui, -apple-system, 'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', sans-serif";
const INK = "#0f172a";
const MUTED = "#475569";
const STYLE: Record<NodeStatus, { fill: string; stroke: string; label: string }> = {
  unchanged: { fill: "#ffffff", stroke: "#64748b", label: "変更なし" },
  added: { fill: "#ecfdf5", stroke: "#047857", label: "追加" },
  changed: { fill: "#fffbeb", stroke: "#b45309", label: "変更" },
  removed: { fill: "#fef2f2", stroke: "#b91c1c", label: "削除" },
};
const EDGE_COLOR: Record<EdgeStatus, string> = {
  unchanged: MUTED,
  added: "#047857",
  removed: "#b91c1c",
};

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textBlock(lines: string[], x: number, y: number, anchor: string, extra = ""): string {
  const spans = lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : LINE_HEIGHT}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  return `<text x="${x}" y="${y}" text-anchor="${anchor}"${extra}>${spans}</text>`;
}

function document(width: number, height: number, title: string, desc: string, body: string[]) {
  const w = Math.ceil(width);
  const h = Math.ceil(height);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${escapeXml(title)}</title>`,
    `<desc id="desc">${escapeXml(desc)}</desc>`,
    `<style>text{font-family:${FONT};font-size:${FONT_SIZE}px;fill:${INK}}.muted{fill:${MUTED}}.heading{font-size:16px;font-weight:600}</style>`,
    "<defs>",
    ...(["unchanged", "added", "removed"] as const).map(
      (status) =>
        `<marker id="arrow-${status}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${EDGE_COLOR[status]}"/></marker>`,
    ),
    "</defs>",
    `<rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff"/>`,
    ...body,
    "</svg>",
    "",
  ].join("\n");
}

/** A smooth curve through the points, leaving and entering each along the flow axis. */
function smoothPath(points: Point[], horizontal: boolean): string {
  const [start, ...rest] = points;
  let d = `M${start![0]},${start![1]}`;
  let previous = start!;
  for (const point of rest) {
    const bend = Math.max(12, (horizontal ? point[0] - previous[0] : point[1] - previous[1]) / 2);
    d += horizontal
      ? ` C${previous[0] + bend},${previous[1]} ${point[0] - bend},${point[1]} ${point[0]},${point[1]}`
      : ` C${previous[0]},${previous[1] + bend} ${point[0]},${point[1] - bend} ${point[0]},${point[1]}`;
    previous = point;
  }
  return d;
}

function anchorPoint(box: Box, side: "start" | "end", horizontal: boolean): Point {
  if (horizontal)
    return side === "end"
      ? [box.x + box.width, box.y + box.height / 2]
      : [box.x, box.y + box.height / 2];
  return side === "end"
    ? [box.x + box.width / 2, box.y + box.height]
    : [box.x + box.width / 2, box.y];
}

function renderGraphPart(
  part: GraphPart,
  direction: Direction,
  offsetX: number,
  offsetY: number,
  statusOf: (node: DiagramNode) => NodeStatus | undefined,
  edgeStatusOf: (edge: DiagramEdge) => EdgeStatus,
): { body: string[]; width: number; height: number } {
  const nodes = part.nodes.map((node) => {
    const status = statusOf(node);
    return status ? { ...node, status } : { ...node, status: undefined };
  });
  if (nodes.length === 0) {
    return {
      body: [`<text x="${offsetX}" y="${offsetY + 18}" class="muted">（なし）</text>`],
      width: 120,
      height: 32,
    };
  }
  const layout = layoutGraph(nodes, part.edges, direction);
  const horizontal = direction === "LR";
  const layerOf = new Map<string, number>();
  layout.layers.forEach((ids, index) => ids.forEach((id) => layerOf.set(id, index)));
  const body: string[] = [];
  const shift = (box: Box): Box => ({ ...box, x: box.x + offsetX, y: box.y + offsetY });
  for (const edge of part.edges) {
    const from = shift(layout.boxes.get(edge.from)!);
    const to = shift(layout.boxes.get(edge.to)!);
    const status = edgeStatusOf(edge);
    const forward = (layerOf.get(edge.to) ?? 0) > (layerOf.get(edge.from) ?? 0);
    let d: string;
    let mid: [number, number];
    if (forward) {
      const via = (layout.routes.get(edge) ?? []).map(
        ([x, y]) => [x + offsetX, y + offsetY] as Point,
      );
      const points: Point[] = [
        anchorPoint(from, "end", horizontal),
        ...via,
        anchorPoint(to, "start", horizontal),
      ];
      d = smoothPath(points, horizontal);
      const first = points[0]!;
      const second = points[1]!;
      mid = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
    } else {
      // Back or same-layer edge: loop around the outside of both boxes.
      const x1 = horizontal ? from.x + from.width / 2 : from.x + from.width;
      const y1 = horizontal ? from.y + from.height : from.y + from.height / 2;
      const x2 = horizontal ? to.x + to.width / 2 : to.x + to.width;
      const y2 = horizontal ? to.y + to.height : to.y + to.height / 2;
      const out = 40;
      d = horizontal
        ? `M${x1},${y1} C${x1},${y1 + out} ${x2},${y2 + out} ${x2},${y2}`
        : `M${x1},${y1} C${x1 + out},${y1} ${x2 + out},${y2} ${x2},${y2}`;
      mid = horizontal
        ? [(x1 + x2) / 2, Math.max(y1, y2) + out * 0.75]
        : [Math.max(x1, x2) + out * 0.75, (y1 + y2) / 2];
    }
    const dash = status === "removed" ? ' stroke-dasharray="6 4"' : "";
    const width = status === "unchanged" ? 1.5 : 2.5;
    body.push(
      `<path d="${d}" fill="none" stroke="${EDGE_COLOR[status]}" stroke-width="${width}"${dash} marker-end="url(#arrow-${status})"/>`,
    );
    const prefix = status === "added" ? "＋ " : status === "removed" ? "－ " : "";
    if (edge.label || prefix) {
      const label = prefix + (edge.label ?? "");
      const w = textWidth(label) + 8;
      const [mx, my] = [Math.round(mid[0]), Math.round(mid[1])];
      body.push(
        `<rect x="${Math.round(mx - w / 2)}" y="${my - 11}" width="${Math.ceil(w)}" height="20" rx="4" fill="#ffffff" opacity="0.92"/>`,
        `<text x="${mx}" y="${my + 4}" text-anchor="middle" class="muted">${escapeXml(label)}</text>`,
      );
    }
  }
  for (const node of nodes) {
    const box = shift(layout.boxes.get(node.id)!);
    const style = STYLE[node.status ?? "unchanged"];
    const dash =
      node.status === "removed"
        ? ' stroke-dasharray="3 3"'
        : node.kind === "external"
          ? ' stroke-dasharray="7 4"'
          : "";
    body.push(
      `<g data-id="${escapeXml(node.id)}">`,
      `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="8" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${node.status && node.status !== "unchanged" ? 2.5 : 1.5}"${dash}/>`,
    );
    if (node.kind === "store") {
      body.push(
        `<rect x="${box.x + 4}" y="${box.y + 4}" width="${box.width - 8}" height="${box.height - 8}" rx="6" fill="none" stroke="${style.stroke}" stroke-width="1"/>`,
      );
    }
    const textTop = box.y + PAD_Y + FONT_SIZE - 1;
    body.push(textBlock(box.lines, box.x + box.width / 2, textTop, "middle"), "</g>");
  }
  return { body, width: layout.width, height: layout.height };
}

function legend(
  statuses: Set<NodeStatus>,
  x: number,
  y: number,
): { body: string[]; height: number } {
  const shown = (["added", "changed", "removed", "unchanged"] as const).filter((status) =>
    statuses.has(status),
  );
  const body = [`<text x="${x}" y="${y + 14}" class="muted">凡例</text>`];
  let cursor = x + 44;
  for (const status of shown) {
    const style = STYLE[status];
    body.push(
      `<rect x="${cursor}" y="${y + 2}" width="16" height="16" rx="3" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2"/>`,
      `<text x="${cursor + 22}" y="${y + 15}">${escapeXml(SYMBOL[status] + style.label)}</text>`,
    );
    cursor += 22 + textWidth(SYMBOL[status] + style.label) + 20;
  }
  return { body, height: 28 };
}

function renderGraph(spec: GraphSpec): string {
  const title = spec.title ?? "図";
  const top = MARGIN + (spec.title ? TITLE_HEIGHT : 0);
  const part = renderGraphPart(
    spec,
    spec.direction,
    MARGIN,
    top,
    (node) => node.status,
    (edge) => edge.status ?? "unchanged",
  );
  const statuses = new Set(spec.nodes.flatMap((node) => (node.status ? [node.status] : [])));
  const body: string[] = [];
  if (spec.title)
    body.push(
      `<text x="${MARGIN}" y="${MARGIN + 18}" class="heading">${escapeXml(spec.title)}</text>`,
    );
  body.push(...part.body);
  let height = top + part.height + MARGIN;
  let width = part.width + MARGIN * 2;
  if (statuses.size) {
    const key = legend(statuses, MARGIN, height - 8);
    body.push(...key.body);
    height += key.height;
    width = Math.max(width, 420);
  }
  const desc = `${spec.nodes.map((node) => node.label).join("、")} の関係を示す図`;
  return document(Math.max(width, 160), height, title, desc, body);
}

function renderCompare(spec: CompareSpec): string {
  const comparison = compareStatuses(spec.asIs, spec.toBe);
  const added = new Set(comparison.addedEdges);
  const removed = new Set(comparison.removedEdges);
  const summary = `追加 ${comparison.summary.added}・変更 ${comparison.summary.changed}・削除 ${comparison.summary.removed}`;
  const heading = MARGIN + (spec.title ? TITLE_HEIGHT : 0);
  // Left-to-right flows are wide, so their two sides stack; top-down flows sit side by side.
  const stacked = spec.direction === "LR";
  const asIsTitle = spec.asIs.title ?? "As-Is（現状）";
  const toBeTitle = spec.toBe.title ?? "To-Be（変更後）";
  const firstTop = heading + 48;
  const left = renderGraphPart(
    spec.asIs,
    spec.direction,
    MARGIN,
    firstTop,
    (node) => comparison.asIs.get(node.id),
    (edge) => (removed.has(edgeKey(edge)) ? "removed" : "unchanged"),
  );
  const secondX = stacked ? MARGIN : MARGIN + Math.max(left.width, 160) + 72;
  const secondHeading = stacked ? firstTop + left.height + 40 : heading + 40;
  const secondTop = stacked ? secondHeading + 8 : firstTop;
  const right = renderGraphPart(
    spec.toBe,
    spec.direction,
    secondX,
    secondTop,
    (node) => comparison.toBe.get(node.id),
    (edge) => (added.has(edgeKey(edge)) ? "added" : "unchanged"),
  );
  const body: string[] = [];
  if (spec.title)
    body.push(
      `<text x="${MARGIN}" y="${MARGIN + 18}" class="heading">${escapeXml(spec.title)}</text>`,
    );
  body.push(
    `<text x="${MARGIN}" y="${heading + 14}" class="muted">${escapeXml(summary)}</text>`,
    `<text x="${MARGIN}" y="${heading + 40}" class="heading">${escapeXml(asIsTitle)}</text>`,
    `<text x="${secondX}" y="${secondHeading}" class="heading">${escapeXml(toBeTitle)}</text>`,
  );
  const contentWidth = stacked
    ? Math.max(left.width, right.width, 160)
    : secondX - MARGIN + Math.max(right.width, 160);
  body.push(
    stacked
      ? `<line x1="${MARGIN}" y1="${secondHeading - 26}" x2="${MARGIN + contentWidth}" y2="${secondHeading - 26}" stroke="#cbd5e1" stroke-width="1"/>`
      : `<line x1="${secondX - 36}" y1="${heading + 24}" x2="${secondX - 36}" y2="${firstTop + Math.max(left.height, right.height)}" stroke="#cbd5e1" stroke-width="1"/>`,
    ...left.body,
    ...right.body,
  );
  let height =
    (stacked ? secondTop + right.height : firstTop + Math.max(left.height, right.height)) + MARGIN;
  const statuses = new Set<NodeStatus>([...comparison.asIs.values(), ...comparison.toBe.values()]);
  const key = legend(statuses, MARGIN, height - 8);
  body.push(...key.body);
  height += key.height;
  const width = Math.max(MARGIN * 2 + contentWidth, 460);
  const title = spec.title ?? "As-Is と To-Be";
  return document(width, height, title, `現状と変更後の比較。${summary}`, body);
}

function renderMatrix(spec: MatrixSpec): string {
  const coverage = matrixCoverage(spec);
  const linked = new Set(spec.links.map(([row, column]) => `${row}\u0000${column}`));
  const rowLines = spec.rows.map((row) => wrapLabel(`${row.id} ${row.label}`, 360));
  const rowHeights = rowLines.map((lines) => lines.length * LINE_HEIGHT + 12);
  const labelWidth =
    Math.max(textWidth(spec.rowHeader), ...rowLines.flat().map(textWidth)) + PAD_X * 2;
  const cellWidth = Math.max(48, ...spec.columns.map((column) => textWidth(column.id) + 16));
  const statusWidth = 72;
  const covered = spec.rows.length - coverage.uncoveredRows.length;
  const summary = `${spec.rowHeader} ${spec.rows.length} 件中 ${covered} 件に${spec.columnHeader}あり`;
  const top = MARGIN + (spec.title ? TITLE_HEIGHT : 0) + 28;
  const headerHeight = 32;
  const body: string[] = [];
  if (spec.title)
    body.push(
      `<text x="${MARGIN}" y="${MARGIN + 18}" class="heading">${escapeXml(spec.title)}</text>`,
    );
  body.push(`<text x="${MARGIN}" y="${top - 10}" class="muted">${escapeXml(summary)}</text>`);
  const gridX = MARGIN + labelWidth;
  body.push(
    `<rect x="${MARGIN}" y="${top}" width="${labelWidth + cellWidth * spec.columns.length + statusWidth}" height="${headerHeight}" fill="#f1f5f9"/>`,
    `<text x="${MARGIN + PAD_X}" y="${top + 21}" class="heading">${escapeXml(spec.rowHeader)}</text>`,
  );
  spec.columns.forEach((column, index) => {
    const x = gridX + index * cellWidth + cellWidth / 2;
    body.push(
      `<text x="${x}" y="${top + 21}" text-anchor="middle"><title>${escapeXml(column.label)}</title>${escapeXml(column.id)}</text>`,
    );
  });
  body.push(
    `<text x="${gridX + spec.columns.length * cellWidth + statusWidth / 2}" y="${top + 21}" text-anchor="middle">判定</text>`,
  );
  let y = top + headerHeight;
  const uncovered = new Set(coverage.uncoveredRows);
  spec.rows.forEach((row, rowIndex) => {
    const height = rowHeights[rowIndex]!;
    const missing = uncovered.has(row.id);
    body.push(
      `<rect x="${MARGIN}" y="${y}" width="${labelWidth + cellWidth * spec.columns.length + statusWidth}" height="${height}" fill="${missing ? "#fef2f2" : rowIndex % 2 ? "#f8fafc" : "#ffffff"}" stroke="#e2e8f0"/>`,
      textBlock(rowLines[rowIndex]!, MARGIN + PAD_X, y + 6 + FONT_SIZE, "start"),
    );
    spec.columns.forEach((column, index) => {
      if (!linked.has(`${row.id}\u0000${column.id}`)) return;
      const x = gridX + index * cellWidth + cellWidth / 2;
      body.push(
        `<text x="${x}" y="${y + height / 2 + 5}" text-anchor="middle" style="fill:#047857;font-weight:700">✔</text>`,
      );
    });
    body.push(
      `<text x="${gridX + spec.columns.length * cellWidth + statusWidth / 2}" y="${y + height / 2 + 5}" text-anchor="middle" style="fill:${missing ? "#b91c1c" : "#047857"};font-weight:600">${missing ? "未対応" : "OK"}</text>`,
    );
    y += height;
  });
  const columnNotes = spec.columns.map((column) => `${column.id}: ${column.label}`);
  y += 20;
  for (const note of columnNotes) {
    body.push(`<text x="${MARGIN}" y="${y}" class="muted">${escapeXml(note)}</text>`);
    y += LINE_HEIGHT;
  }
  if (coverage.orphanColumns.length) {
    y += 6;
    body.push(
      `<text x="${MARGIN}" y="${y}" style="fill:#b45309">${escapeXml(`${spec.rowHeader}に対応しない${spec.columnHeader}: ${coverage.orphanColumns.join("、")}`)}</text>`,
    );
    y += LINE_HEIGHT;
  }
  const width = Math.max(
    MARGIN * 2 + labelWidth + cellWidth * spec.columns.length + statusWidth,
    MARGIN * 2 + Math.max(textWidth(summary), ...columnNotes.map(textWidth)),
  );
  return document(width, y + MARGIN, spec.title ?? "対応表", summary, body);
}

/** Render a validated diagram source to SVG text. */
export function renderSvg(spec: DiagramSpec): string {
  if (spec.type === "graph") return renderGraph(spec);
  if (spec.type === "compare") return renderCompare(spec);
  return renderMatrix(spec);
}

// ---------------------------------------------------------------------------
// Markdown checks.

export type ImageRef = { alt: string; path: string };
export type Violation = { code: string; message: string; target?: string };
export type CheckReport = { pass: boolean; diagrams: number; violations: Violation[] };

export function findImageRefs(markdown: string): ImageRef[] {
  const text = markdown.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "");
  const refs: Array<ImageRef & { index: number }> = [];
  for (const match of text.matchAll(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g))
    refs.push({ alt: match[1] ?? "", path: match[2] ?? "", index: match.index ?? 0 });
  for (const match of text.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(match[0])?.[1] ?? "";
    refs.push({ alt, path: match[1] ?? "", index: match.index ?? 0 });
  }
  return refs.sort((a, b) => a.index - b.index).map(({ alt, path: ref }) => ({ alt, path: ref }));
}

function readText(file: string): string | null {
  try {
    return statSync(file).isFile() ? readFileSync(file, "utf8") : null;
  } catch {
    return null;
  }
}

const normalize = (text: string) => text.replace(/\r\n?/g, "\n");

/** Check that a Markdown document embeds only local, up-to-date diagrams. */
export function checkMarkdown(file: string, options: { minDiagrams: number }): CheckReport {
  const markdown = readText(file);
  if (markdown === null)
    return {
      pass: false,
      diagrams: 0,
      violations: [{ code: "unreadable", message: `文書を読めません: ${file}`, target: file }],
    };
  const base = path.dirname(path.resolve(file));
  const violations: Violation[] = [];
  let diagrams = 0;
  for (const ref of findImageRefs(markdown)) {
    const target = ref.path;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
      violations.push({
        code: "external-image",
        message: "外部の画像は使えません。リポジトリ内の SVG を参照してください。",
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
    const resolved = path.resolve(base, decodeURIComponent(target));
    const relative = path.relative(base, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      violations.push({
        code: "outside-path",
        message: "画像は文書と同じフォルダーの中に置いてください。",
        target,
      });
      continue;
    }
    const image = readText(resolved);
    if (image === null) {
      violations.push({ code: "missing-image", message: "画像のファイルがありません。", target });
      continue;
    }
    if (path.extname(resolved).toLowerCase() !== ".svg") continue;
    const sourcePath = resolved.slice(0, -4) + ".json";
    const source = readText(sourcePath);
    if (source === null) {
      violations.push({
        code: "missing-source",
        message: "図の元データ（同じ名前の .json）がありません。",
        target,
      });
      continue;
    }
    let parsed: Result<DiagramSpec>;
    try {
      parsed = parseSpec(JSON.parse(source));
    } catch (error) {
      parsed = { ok: false, errors: [`JSON を読めません: ${(error as Error).message}`] };
    }
    if (!parsed.ok) {
      violations.push({
        code: "invalid-source",
        message: `図の元データが正しくありません: ${parsed.errors.join(" / ")}`,
        target,
      });
      continue;
    }
    if (normalize(image) !== normalize(renderSvg(parsed.value))) {
      violations.push({
        code: "stale-image",
        message: `図が元データと一致しません。focus-diagram.ts render で再生成してください。`,
        target,
      });
      continue;
    }
    diagrams++;
  }
  if (diagrams < options.minDiagrams)
    violations.push({
      code: "no-diagram",
      message: `図解が必要です（${options.minDiagrams} 件以上）。図の元データから SVG を作り、本文に埋め込んでください。`,
    });
  return { pass: violations.length === 0, diagrams, violations };
}

// ---------------------------------------------------------------------------
// Sensor and CLI.

/** Artifacts a person reviews at a gate; each must explain itself with a diagram. */
export const DIAGRAM_REQUIRED = new Set([
  "architecture",
  "requirements",
  "components",
  "unit-of-work",
  "bolt-plan",
  "focus-test-report",
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
  "使い方:",
  "  focus-diagram.ts render <source.json> [--out <image.svg>]",
  "  focus-diagram.ts check <document.md> [--min <n>]",
  "  focus-diagram.ts sensor --stage <slug> --output-path <document.md>",
  "",
].join("\n");

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function runCli(input: string[], io: CliIo): Promise<number> {
  // The engine's sensor dispatcher runs the script with only its fire flags.
  const argv = input[0]?.startsWith("--") ? ["sensor", ...input] : input;
  const [command, first] = argv;
  if (command === "render" && first) {
    const source = path.resolve(io.cwd, first);
    const text = readText(source);
    if (text === null) {
      io.stderr(`元データを読めません: ${first}\n`);
      return 1;
    }
    let parsed: Result<DiagramSpec>;
    try {
      parsed = parseSpec(JSON.parse(text));
    } catch (error) {
      io.stderr(`JSON を読めません: ${(error as Error).message}\n`);
      return 1;
    }
    if (!parsed.ok) {
      io.stderr(`${parsed.errors.join("\n")}\n`);
      return 1;
    }
    const out = path.resolve(
      io.cwd,
      option(argv, "--out") ?? source.replace(/\.json$/i, "") + ".svg",
    );
    writeFileSync(out, renderSvg(parsed.value));
    io.stdout(`${path.relative(io.cwd, out) || out}\n`);
    return 0;
  }
  if (command === "check" && first) {
    const min = Number(option(argv, "--min") ?? "0");
    const report = checkMarkdown(path.resolve(io.cwd, first), {
      minDiagrams: Number.isInteger(min) && min > 0 ? min : 0,
    });
    io.stdout(`${JSON.stringify(report)}\n`);
    return report.pass ? 0 : 1;
  }
  if (command === "sensor") {
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
  io.stderr(USAGE);
  return 2;
}

if (import.meta.main) {
  const code = await runCli(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    cwd: process.cwd(),
  });
  process.exit(code);
}
