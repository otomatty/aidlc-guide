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
export type EdgeStatus = "added" | "changed" | "removed" | "unchanged";
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
const EDGE_STATUSES: readonly EdgeStatus[] = ["added", "changed", "removed", "unchanged"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Characters XML 1.0 forbids (tab, line feed and carriage return are allowed); an SVG holding one does not open.
// oxlint-disable-next-line no-control-regex -- matching control characters is the point
const XML_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|\p{Cs}/u;

function xmlSafe(value: string, where: string, errors: string[]): boolean {
  if (!XML_FORBIDDEN.test(value)) return true;
  errors.push(`${where} に、図に使えない制御文字が含まれています。`);
  return false;
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
  if (!oneLine(value, where, errors)) return undefined;
  return xmlSafe(value, where, errors) ? value : undefined;
}

/** Titles, edge labels, headers and column notes are drawn and measured as one line. */
function oneLine(value: string, where: string, errors: string[]): boolean {
  if (!/[\t\n\r]/.test(value)) return true;
  errors.push(`${where} は改行やタブを使わず、1 行で書いてください。`);
  return false;
}

function requiredLabel(value: unknown, where: string, max: number, errors: string[]): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    errors.push(`${where} は 1〜${max} 文字の文字列にしてください。`);
    return "";
  }
  return xmlSafe(value, where, errors) ? value : "";
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
  // One edge per direction between two nodes: parallel edges would overlap and cannot be compared.
  const pairs = new Map<string, number>();
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
      const pair = `${raw.from}->${raw.to}`;
      const first = pairs.get(pair);
      if (first !== undefined) {
        errors.push(
          `${at} は ${prefix}edges[${first}] と同じ from・to です。1 本にまとめ、ラベルを「読む / 書く」のように並べてください。`,
        );
        return;
      }
      pairs.set(pair, index);
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

function parseItems(
  value: unknown,
  where: string,
  errors: string[],
  singleLine = false,
): MatrixItem[] {
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
    const label = requiredLabel(raw.label, `${at}.label`, 200, errors);
    // Kept even when its label is refused, so links to it are not reported as unknown too.
    if (label && singleLine) oneLine(label, `${at}.label`, errors);
    items.push({ id: raw.id, label });
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
    // The graph's own title is the spec's title, read once above.
    const part = parsePart({ ...input, title: undefined }, "", errors, false);
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
    // A column's label is written out as a one-line note below the table.
    const columns = parseItems(input.columns, "columns", errors, true);
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

/** Width of a heading, which is drawn at 16px in a heavier weight. */
function headingWidth(text: string): number {
  return Math.ceil(textWidth(text) * 1.2);
}

/** Split a label into lines no wider than `max`, keeping ASCII words whole when possible. */
export function wrapLabel(label: string, max: number): string[] {
  const lines: string[] = [];
  // XML reads CR and CRLF as line feeds, so every form breaks the line. A tab is drawn as the
  // space it is measured as, not expanded to a tab stop.
  for (const paragraph of label.replace(/\t/g, " ").split(/\r\n?|\n/)) {
    const tokens = paragraph.match(/[A-Za-z0-9_.,:;!?'"()/-]+|\s+|./gu) ?? [];
    let line = "";
    for (const token of tokens) {
      if (/^\s+$/.test(token)) {
        // Keep spacing inside a line; a break swallows the spaces it falls on.
        if (line) line += token;
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
/** How far a node's own loop reaches out of its box; longer than an arrowhead. */
const LOOP_OUT = 24;
/** How far a back edge runs into the gap beside a layer before it turns; longer than an arrowhead. */
const TURN_OUT = 24;
/** Clearance between the boxes and the first lane that back edges run along, and between lanes. */
const LANE_GAP = 20;
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

/** The widest an edge's label can be drawn, with room for a status symbol in front of it. */
function labelRoom(edge: DiagramEdge): number {
  return textWidth(`＋ ${edge.label ?? ""}`) + 8;
}

/** Edge-label clearance between layers; a label sits in the gap it crosses. */
export function layerGap(edges: DiagramEdge[]): number {
  const widest = Math.max(0, ...edges.map((edge) => (edge.label ? labelRoom(edge) : 0)));
  return Math.max(LAYER_GAP, Math.ceil(widest + 32));
}

/**
 * Room kept free beside a box, across the flow, for the node's own loop and its label: below
 * the box in a left-to-right flow (label under the loop), right of it in a top-down one (label
 * beside the loop). Only edges along the flow use the gaps between layers, so the loop meets none.
 */
function loopRoom(edge: DiagramEdge, horizontal: boolean): number {
  return LOOP_OUT + 4 + (horizontal ? 24 : labelRoom(edge) + 4);
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
  // Labels sit between the layers of a left-to-right flow; in a top-down flow they cross the line.
  const gap = horizontal ? layerGap(edges) : LAYER_GAP;
  const loops = new Map(
    edges
      .filter((edge) => edge.from === edge.to)
      .map((edge) => [edge.from, loopRoom(edge, horizontal)]),
  );
  const cross = (id: string) =>
    (horizontal ? measured.get(id)!.height : measured.get(id)!.width) + (loops.get(id) ?? 0);
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
  changedEdges: string[];
  removedEdges: string[];
  summary: { added: number; changed: number; removed: number };
  edgeSummary: { added: number; changed: number; removed: number };
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
      !prior
        ? "added"
        : prior.label !== node.label || prior.kind !== node.kind
          ? "changed"
          : "unchanged",
    );
  }
  const asIsStatus = new Map<string, NodeStatus>(
    asIs.nodes.map((node) => [node.id, after.has(node.id) ? "unchanged" : "removed"]),
  );
  const beforeEdges = new Map(asIs.edges.map((edge) => [edgeKey(edge), edge]));
  const afterEdges = new Set(toBe.edges.map(edgeKey));
  const addedEdges = toBe.edges.map(edgeKey).filter((key) => !beforeEdges.has(key));
  const changedEdges = toBe.edges
    .filter((edge) => {
      const prior = beforeEdges.get(edgeKey(edge));
      return prior !== undefined && (prior.label ?? "") !== (edge.label ?? "");
    })
    .map(edgeKey);
  const removedEdges = asIs.edges.map(edgeKey).filter((key) => !afterEdges.has(key));
  const count = (map: Map<string, NodeStatus>, status: NodeStatus) =>
    [...map.values()].filter((value) => value === status).length;
  return {
    asIs: asIsStatus,
    toBe: toBeStatus,
    addedEdges,
    changedEdges,
    removedEdges,
    edgeSummary: {
      added: addedEdges.length,
      changed: changedEdges.length,
      removed: removedEdges.length,
    },
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
  changed: "#b45309",
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
    `<style>text{font-family:${FONT};font-size:${FONT_SIZE}px;fill:${INK};white-space:pre}.muted{fill:${MUTED}}.heading{font-size:16px;font-weight:600}</style>`,
    "<defs>",
    ...(["unchanged", "added", "changed", "removed"] as const).map(
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
  // Lay the edges out in the part's own coordinates first: loops and wide labels can reach past
  // the boxes, and the part is then shifted and sized so that everything stays inside the image.
  const edges: Array<{
    status: EdgeStatus;
    points: Point[];
    curved: boolean;
    label: string;
    mid: Point;
  }> = [];
  let [minX, minY, maxX, maxY] = [0, 0, layout.width, layout.height];
  const include = (x: number, y: number) => {
    [minX, minY] = [Math.min(minX, x), Math.min(minY, y)];
    [maxX, maxY] = [Math.max(maxX, x), Math.max(maxY, y)];
  };
  // Points are written as (along the flow, across it); `at` turns one into image coordinates.
  const at = (along: number, across: number): Point =>
    horizontal ? [along, across] : [across, along];
  const flow = (box: Box) =>
    horizontal
      ? [box.x, box.x + box.width, box.y, box.height]
      : [box.y, box.y + box.height, box.x, box.width];
  // Where each layer starts and ends along the flow. The gaps between layers hold no boxes, and
  // nothing lies beyond the far side across the flow, so lines kept there cannot cross a box.
  const extent = layout.layers.map((ids) => {
    const spans = ids.map((id) => flow(layout.boxes.get(id)!));
    return [Math.min(...spans.map(([start]) => start!)), Math.max(...spans.map(([, end]) => end!))];
  });
  let lane = horizontal ? layout.height : layout.width;
  let backEdges = 0;
  for (const edge of part.edges) {
    const from = layout.boxes.get(edge.from)!;
    const to = layout.boxes.get(edge.to)!;
    const status = edgeStatusOf(edge);
    const source = layerOf.get(edge.from) ?? 0;
    const target = layerOf.get(edge.to) ?? 0;
    const prefix =
      status === "added" ? "＋ " : status === "changed" ? "△ " : status === "removed" ? "－ " : "";
    const label = edge.label || prefix ? prefix + (edge.label ?? "") : "";
    const labelWidth = label ? textWidth(label) + 8 : 0;
    let points: Point[];
    let mid: Point;
    if (target > source) {
      // Straight out across the rest of the source layer, curved only in the gaps between layers
      // (which hold no boxes), straight through each skipped layer's placeholder slot, and
      // straight into the target. A wider sibling in either layer is never crossed.
      const [, , fromCross, fromSize] = flow(from);
      const [, , toCross, toSize] = flow(to);
      const leave = fromCross! + fromSize! / 2;
      const via = (layout.routes.get(edge) ?? []).flatMap((point, index) => {
        const across = horizontal ? point[1] : point[0];
        const [start, end] = extent[source + 1 + index]!;
        return [at(start!, across), at(end!, across)];
      });
      const out = at(extent[source]![1]!, leave);
      const enter = at(extent[target]![0]!, toCross! + toSize! / 2);
      points = [
        anchorPoint(from, "end", horizontal),
        out,
        ...via,
        enter,
        anchorPoint(to, "start", horizontal),
      ].filter(
        (point, index, all) =>
          index === 0 || point[0] !== all[index - 1]![0] || point[1] !== all[index - 1]![1],
      );
      // The label sits on the curve across the first gap, between the source layer's edge and
      // the next layer.
      const next = via[0] ?? enter;
      mid = [(out[0] + next[0]) / 2, (out[1] + next[1]) / 2];
    } else if (edge.from === edge.to) {
      // A node's own loop leaves and re-enters the box's far side across the flow, in the room
      // the layout kept free for it there.
      const [start, , across, size] = flow(from);
      const depth = horizontal ? from.width : from.height;
      const out = across! + size! + LOOP_OUT;
      const [leave, enter] = [start! + depth * 0.25, start! + depth * 0.75];
      points = [
        at(leave, across! + size!),
        at(leave, out),
        at(enter, out),
        at(enter, across! + size!),
      ];
      mid = horizontal
        ? [(leave + enter) / 2, out + 14]
        : [out + 4 + labelWidth / 2, (leave + enter) / 2];
    } else {
      // A back edge turns into the gap after its source layer, runs back along its own lane
      // beyond every box, and turns into the gap before its target layer.
      const [, end, start, size] = flow(from);
      const [toStart, , toCross, toSize] = flow(to);
      const half = horizontal ? 10 : labelWidth / 2;
      const track = lane + LANE_GAP + half;
      lane = track + half;
      // Staggered, so two back edges through the same gap never run along the same line; an exit
      // and an entry from opposite sides of a gap stay apart, as the gap is wider than both turns.
      const turn = TURN_OUT + 5 * (backEdges++ % 3);
      const exit = extent[source]![1]! + turn;
      const entry = extent[target]![0]! - turn;
      points = [
        at(end!, start! + size! / 2),
        at(exit, start! + size! / 2),
        at(exit, track),
        at(entry, track),
        at(entry, toCross! + toSize! / 2),
        at(toStart!, toCross! + toSize! / 2),
      ];
      mid = at((exit + entry) / 2, track);
    }
    if (target <= source) points.forEach(([x, y]) => include(x, y));
    if (label) {
      include(Math.floor(mid[0] - labelWidth / 2), Math.round(mid[1]) - 11);
      include(Math.ceil(mid[0] + labelWidth / 2), Math.round(mid[1]) + 9);
    }
    edges.push({ status, points, curved: target > source, label, mid });
  }
  const dx = offsetX - minX;
  const dy = offsetY - minY;
  const shift = (box: Box): Box => ({ ...box, x: box.x + dx, y: box.y + dy });
  const body: string[] = [];
  for (const { status, points, curved, label, mid } of edges) {
    const moved = points.map(([x, y]) => [x + dx, y + dy] as Point);
    const d = curved
      ? smoothPath(moved, horizontal)
      : `M${moved.map((point) => point.join(",")).join(" L")}`;
    const dash = status === "removed" ? ' stroke-dasharray="6 4"' : "";
    const width = status === "unchanged" ? 1.5 : 2.5;
    body.push(
      `<path d="${d}" fill="none" stroke="${EDGE_COLOR[status]}" stroke-width="${width}"${dash} marker-end="url(#arrow-${status})"/>`,
    );
    if (label) {
      const w = textWidth(label) + 8;
      const [mx, my] = [Math.round(mid[0] + dx), Math.round(mid[1] + dy)];
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
  return { body, width: maxX - minX, height: maxY - minY };
}

function legend(
  statuses: Set<NodeStatus>,
  x: number,
  y: number,
): { body: string[]; height: number; width: number } {
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
  return { body, height: 28, width: cursor - 20 - x };
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
  // Edges carry statuses too, so they count for the legend and the description.
  const statuses = new Set([
    ...spec.nodes.flatMap((node) => (node.status ? [node.status] : [])),
    ...spec.edges.flatMap((edge) => (edge.status ? [edge.status] : [])),
  ]);
  const body: string[] = [];
  if (spec.title)
    body.push(
      `<text x="${MARGIN}" y="${MARGIN + 18}" class="heading">${escapeXml(spec.title)}</text>`,
    );
  body.push(...part.body);
  let height = top + part.height + MARGIN;
  let width = MARGIN * 2 + Math.max(part.width, spec.title ? headingWidth(spec.title) : 0);
  if (statuses.size) {
    const key = legend(statuses, MARGIN, height - 8);
    body.push(...key.body);
    height += key.height;
    width = Math.max(width, 420, MARGIN * 2 + key.width);
  }
  const count = (items: Array<{ status?: NodeStatus }>, status: NodeStatus) =>
    items.filter((item) => item.status === status).length;
  const changes = (["added", "changed", "removed"] as const).map((status) => STYLE[status].label);
  const tally = (items: Array<{ status?: NodeStatus }>) =>
    (["added", "changed", "removed"] as const)
      .map((status, index) => `${changes[index]} ${count(items, status)}`)
      .join("・");
  const desc =
    `${spec.nodes.map((node) => node.label).join("、")} の関係を示す図` +
    (statuses.size ? `（要素 ${tally(spec.nodes)} ／ 矢印 ${tally(spec.edges)}）` : "");
  return document(Math.max(width, 160), height, title, desc, body);
}

function renderCompare(spec: CompareSpec): string {
  const comparison = compareStatuses(spec.asIs, spec.toBe);
  const added = new Set(comparison.addedEdges);
  const changed = new Set(comparison.changedEdges);
  const removed = new Set(comparison.removedEdges);
  const nodes = comparison.summary;
  const edges = comparison.edgeSummary;
  const summary = `要素 追加 ${nodes.added}・変更 ${nodes.changed}・削除 ${nodes.removed} ／ 矢印 追加 ${edges.added}・変更 ${edges.changed}・削除 ${edges.removed}`;
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
  const leftWidth = Math.max(left.width, 160, headingWidth(asIsTitle));
  const secondX = stacked ? MARGIN : MARGIN + leftWidth + 72;
  const secondHeading = stacked ? firstTop + left.height + 40 : heading + 40;
  const secondTop = stacked ? secondHeading + 8 : firstTop;
  const right = renderGraphPart(
    spec.toBe,
    spec.direction,
    secondX,
    secondTop,
    (node) => comparison.toBe.get(node.id),
    (edge) =>
      added.has(edgeKey(edge)) ? "added" : changed.has(edgeKey(edge)) ? "changed" : "unchanged",
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
  const rightWidth = Math.max(right.width, 160, headingWidth(toBeTitle));
  const contentWidth = stacked ? Math.max(leftWidth, rightWidth) : secondX - MARGIN + rightWidth;
  body.push(
    stacked
      ? `<line x1="${MARGIN}" y1="${secondHeading - 26}" x2="${MARGIN + contentWidth}" y2="${secondHeading - 26}" stroke="#cbd5e1" stroke-width="1"/>`
      : `<line x1="${secondX - 36}" y1="${heading + 24}" x2="${secondX - 36}" y2="${firstTop + Math.max(left.height, right.height)}" stroke="#cbd5e1" stroke-width="1"/>`,
    ...left.body,
    ...right.body,
  );
  let height =
    (stacked ? secondTop + right.height : firstTop + Math.max(left.height, right.height)) + MARGIN;
  const statuses = new Set<NodeStatus>([
    ...comparison.asIs.values(),
    ...comparison.toBe.values(),
    // Edges carry statuses too, so they count for the legend.
    ...(comparison.addedEdges.length ? (["added"] as const) : []),
    ...(comparison.changedEdges.length ? (["changed"] as const) : []),
    ...(comparison.removedEdges.length ? (["removed"] as const) : []),
  ]);
  const key = legend(statuses, MARGIN, height - 8);
  body.push(...key.body);
  height += key.height;
  const width =
    MARGIN * 2 +
    Math.max(
      contentWidth,
      textWidth(summary),
      spec.title ? headingWidth(spec.title) : 0,
      key.width,
      412,
    );
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
  const warning = coverage.orphanColumns.length
    ? `${spec.rowHeader}に対応しない${spec.columnHeader}: ${coverage.orphanColumns.join("、")}`
    : "";
  if (warning) {
    y += 6;
    body.push(`<text x="${MARGIN}" y="${y}" style="fill:#b45309">${escapeXml(warning)}</text>`);
    y += LINE_HEIGHT;
  }
  const width = Math.max(
    MARGIN * 2 + labelWidth + cellWidth * spec.columns.length + statusWidth,
    MARGIN * 2 +
      Math.max(
        textWidth(summary),
        textWidth(warning),
        ...columnNotes.map(textWidth),
        spec.title ? headingWidth(spec.title) : 0,
      ),
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

/**
 * `uncertain`: the reader may not see the image as an image: it sits on a line indented like code
 * (4 spaces or a tab), or it is Markdown inside a raw HTML block, which shows it as text.
 */
export type ImageRef = { alt: string; path: string; uncertain: boolean };
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

const NAMED_REFERENCES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  colon: ":",
  sol: "/",
  period: ".",
  tab: "\t",
  newline: "\n",
};

/**
 * Decode character references the way a browser does before it loads an address, so an encoded
 * address (`https&#58;//`) is checked as what it becomes. Unknown named references stay as written,
 * and the check rejects an address that still holds one.
 */
function decodeReferences(text: string): string {
  return text.replace(
    /&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]+));?/gi,
    (whole, decimal?: string, hex?: string, name?: string) => {
      if (decimal || hex) {
        const code = decimal ? Number(decimal) : Number.parseInt(hex ?? "", 16);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
      }
      return NAMED_REFERENCES[(name ?? "").toLowerCase()] ?? whole;
    },
  );
}

/**
 * An address as a browser resolves it: references decoded, tabs and line breaks dropped, and the
 * spaces and control characters at either end stripped.
 */
function asLoaded(address: string): string {
  const loaded = decodeReferences(address).replace(/[\t\n\r]/g, "");
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
  // Inline code shows as text: each of its characters becomes one that means nothing to the
  // scans below, its line breaks kept, so nothing joins across it and every line stays put.
  const shown = withoutFencedCode(expandIndentTabs(markdown.replace(/\r\n?/g, "\n"))).replace(
    /(`+)(?!`)(?:[^\n]|\n(?![ \t]*\n))*?[^`\n]\1(?!`)/g,
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
  // Nothing but an optional title may follow the address on its line; otherwise the line is text.
  // A bare address must balance its parentheses, and a title cannot hold a blank line.
  for (const match of bodies.matchAll(
    /^ {0,3}\[((?:\\.|[^\]\\])+)\]:[ \t]*(?:\n[ \t]*)?(?:<((?:\\.|[^<>\\\n])*)>|([^\s<]\S*))(?:[ \t]*$|[ \t]+(?:"(?:\\.|(?!\n[ \t]*\n)[^"\\])*"|'(?:\\.|(?!\n[ \t]*\n)[^'\\])*'|\((?:\\.|(?!\n[ \t]*\n)[^()\\])*\))[ \t]*$)/gm,
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
  // Every other address a visible element would load is checked too: each candidate of src,
  // srcset, imagesrcset, poster, data, background, href and xlink:href, every CSS url(), and any
  // absolute address elsewhere in the tag. Links, and references to a part of the page itself
  // (`#id`), are left alone.
  // A tag ends at the first `>` outside a quoted attribute value.
  // CSS loads url() addresses, @import strings, and the plain string candidates of image-set().
  const cssUrls = (css: string) => [
    ...[...css.matchAll(/url\(\s*(['"]?)([^)]*?)\1\s*\)|@import\s+(['"])([^'"]*)\3/gi)].map(
      (url) => ({ path: url[2] ?? url[4] ?? "", offset: url.index ?? 0 }),
    ),
    ...[...css.matchAll(/image-set\(((?:[^()]|\([^()]*\))*)\)/gi)].flatMap((set) =>
      [...(set[1] ?? "").matchAll(/(?<!url\(\s*)(['"])([^'"]*)\1/gi)].map((candidate) => ({
        path: candidate[2] ?? "",
        offset: (set.index ?? 0) + "image-set(".length + (candidate.index ?? 0),
      })),
    ),
  ];
  const outsidePage = (address: string) => address !== "" && !address.startsWith("#");
  // A `<` after an odd number of backslashes is escaped Markdown text, not a tag; inside a raw HTML
  // block a backslash is just a character, so the tag after it is real.
  const escaped = (index: number) => escapedIn(text, index) && !blocks[lineOf(index)]?.html;
  // Script, style, textarea and title text: a tag there is text, and an image there is not shown.
  const content = contentRanges(text, escaped);
  const { raw } = content;
  // An image written inside a tag, in an attribute value, is part of the tag and not shown.
  const tags: Array<[number, number]> = [];
  for (const match of text.matchAll(/<([a-z][a-z0-9-]*)(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const [tag] = match;
    const name = (match[1] ?? "").toLowerCase();
    const index = match.index ?? 0;
    // A tag-shaped string in script, style, textarea or title text loads nothing.
    if (escaped(index) || raw.some(([from, to]) => index >= from && index < to)) continue;
    tags.push([index, index + tag.length]);
    // A link's own address is where it goes, not something it loads, and text attributes such
    // as alt and title are only shown; the rest of the tag is checked.
    const link = name === "a" || name === "area";
    const loads = [...htmlAttributes(tag)]
      .filter(
        ([attr]) =>
          !(link && NAVIGATION_ATTRIBUTES.has(attr)) &&
          !TEXT_ATTRIBUTES.has(attr) &&
          !attr.startsWith("aria-"),
      )
      .map(([attr, value]) => `${attr}="${value}"`)
      .join(" ");
    const written = name === "img" ? attribute(tag, "src") : undefined;
    const src = written === undefined ? undefined : asLoaded(written);
    if (src) refs.push({ alt: attribute(tag, "alt") ?? "", path: src, index, markdown: false });
    const seen = new Set(src ? [src] : []);
    const resource = (path: string) => {
      if (!outsidePage(path) || seen.has(path)) return;
      seen.add(path);
      refs.push({ alt: "", path, index, markdown: false, resource: true });
    };
    for (const attr of [
      "src",
      "srcset",
      "imagesrcset",
      "poster",
      "data",
      "background",
      "href",
      "xlink:href",
    ]) {
      const value =
        (name === "img" && attr === "src") || (link && NAVIGATION_ATTRIBUTES.has(attr))
          ? undefined
          : attribute(tag, attr);
      if (value === undefined) continue;
      const candidates = attr.endsWith("srcset")
        ? value.split(",").map((part) => part.trim().split(/\s+/)[0] ?? "")
        : [value];
      candidates.forEach((candidate) => resource(asLoaded(candidate)));
    }
    for (const url of cssUrls(asLoaded(loads))) resource(url.path);
    // An iframe's srcdoc is a page of its own, and what it loads is checked too.
    const srcdoc = name === "iframe" ? attribute(tag, "srcdoc") : undefined;
    if (srcdoc) for (const inner of findImageRefs(decodeReferences(srcdoc))) resource(inner.path);
    for (const url of ` ${asLoaded(loads)}`.matchAll(
      /(?:\b(?:https?|ftp|file|data):|(?<=["'\s=(,])\/\/)[^\s"'<>),]+/gi,
    ))
      resource(url[0]);
  }
  // A style sheet in the page loads its addresses too.
  for (const sheet of text.matchAll(
    /(<style\b(?:[^>"']|"[^"]*"|'[^']*')*>)([\s\S]*?)(?:<\/style\s*>|$)/gi,
  )) {
    if (escaped(sheet.index ?? 0)) continue;
    const start = (sheet.index ?? 0) + (sheet[1] ?? "").length;
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
  return refs
    .sort((a, b) => a.index - b.index)
    .map(({ alt, path: ref, index, markdown, hiddenDefinition, resource, insideAlt }) => {
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
          indented ||
          afterOpenComment ||
          hiddenDefinition === true ||
          resource === true ||
          insideAlt === true ||
          escapedComments.some(([from, to]) => index >= from && index < to) ||
          unseen.some(([start, end]) => index >= start && index < end) ||
          raw.some(([start, end]) => index >= start && index < end) ||
          metadata.some(([start, end]) => index > start && index < end) ||
          (markdown && definitionLines.has(number)) ||
          (markdown && tags.some(([start, end]) => index > start && index < end)) ||
          (markdown ? block?.html === true : block?.rawText === true),
      };
    });
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

const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title"]);

/** Attributes whose value is only shown or read out, never loaded. */
const TEXT_ATTRIBUTES = new Set(["alt", "title", "placeholder", "label"]);

/**
 * Whether a style attribute hides its element: a `display: none` or `visibility: hidden` (or
 * `collapse`) declaration of its own, read after CSS drops comments; a custom property such as
 * `--display` or text inside a string value does not count.
 */
function hiddenByStyle(style: string): boolean {
  const css = style
    .replace(/\/\*[\s\S]*?(?:\*\/|$)/g, " ")
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
  return css.split(";").some((declaration) => {
    const match = /^\s*([a-z-]+)\s*:\s*([\s\S]*?)\s*(?:!\s*important\s*)?$/i.exec(declaration);
    const property = (match?.[1] ?? "").toLowerCase();
    const value = match?.[2] ?? "";
    return (
      (property === "display" && /^none$/i.test(value)) ||
      (property === "visibility" && /^(?:hidden|collapse)$/i.test(value))
    );
  });
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

/** Where a link goes, rather than what it loads. */
const NAVIGATION_ATTRIBUTES = new Set(["href", "xlink:href", "ping"]);

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
 * Where tags and the text of raw-text elements (<script>, <style>, <textarea>, <title>) stand,
 * read in order with comments skipped, so a `<!--` found inside one is known to open no comment.
 * A tag whose `<` is escaped is Markdown text.
 */
function markupRanges(
  source: string,
  escaped: (index: number) => boolean,
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const token =
    /<!--|<(script|style|textarea|title)(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>|<\/?[a-z][a-z0-9-]*(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
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
    if (match[1]) {
      const close = source.slice(end).search(new RegExp(`</${match[1]}[\\s/>]`, "i"));
      end = close < 0 ? source.length : end + close;
    }
    ranges.push([start, end]);
    token.lastIndex = end;
  }
  return ranges;
}

/**
 * Two kinds of content a browser parses differently: the text of <script>, <style>, <textarea>
 * and <title> elements (`raw`), never read as tags or shown as images, up to their end tag or the
 * end of the page; and <svg> and <math> elements (`foreign`), whose content is markup where `/>`
 * closes any element, a <script> or <style> included.
 */
function contentRanges(
  text: string,
  escaped: (index: number) => boolean,
): { raw: Array<[number, number]>; foreign: Array<[number, number]> } {
  const raw: Array<[number, number]> = [];
  const foreign: Array<[number, number]> = [];
  const tags = /<(script|style|textarea|title|svg|math)(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  for (let match = tags.exec(text); match; match = tags.exec(text)) {
    const start = match.index;
    const name = (match[1] ?? "").toLowerCase();
    const from = start + match[0].length;
    if (escaped(start)) continue;
    if (name === "svg" || name === "math") {
      if (match[0].endsWith("/>")) continue;
      tags.lastIndex = elementEnd(text, name, from, true);
      foreign.push([start, tags.lastIndex]);
      continue;
    }
    const close = text.slice(from).search(new RegExp(`</${name}[\\s/>]`, "i"));
    tags.lastIndex = close < 0 ? text.length : from + close;
    raw.push([from, tags.lastIndex]);
  }
  return { raw, foreign };
}

/**
 * Stretches of the page HTML never shows: <template> and <noscript> content, and any element
 * marked `hidden` or styled `display: none` / `visibility: hidden`, up to its matching end tag
 * (or the end of the page). Images there are checked but not counted.
 */
function hiddenHtmlRanges(
  text: string,
  escaped: (index: number) => boolean,
  { raw, foreign }: { raw: Array<[number, number]>; foreign: Array<[number, number]> },
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  // A tag-shaped string inside script, style, textarea or title text is no tag.
  const skipped = (start: number) =>
    escaped(start) || raw.some(([from, to]) => start >= from && start < to);
  for (const match of text.matchAll(/<([a-z][a-z0-9-]*)(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const [tag] = match;
    const name = (match[1] ?? "").toLowerCase();
    const start = match.index ?? 0;
    if (skipped(start)) continue;
    const attributes = htmlAttributes(tag);
    const hidden =
      name === "template" ||
      name === "noscript" ||
      attributes.has("hidden") ||
      hiddenByStyle(attributes.get("style") ?? "");
    if (!hidden) continue;
    // HTML ignores `/>` on an ordinary element, so `<div hidden/>` stays open; only a void
    // element, or an element inside <svg> or <math> (or one of those itself), ends there.
    const inForeign =
      name === "svg" || name === "math" || foreign.some(([from, to]) => start > from && start < to);
    if (VOID_ELEMENTS.has(name) || (inForeign && tag.endsWith("/>"))) {
      ranges.push([start, start + tag.length]);
      continue;
    }
    ranges.push([start, elementEnd(text, name, start + tag.length, inForeign)]);
  }
  return ranges;
}

/**
 * Where the element named `name` whose start tag ends at `from` ends: at its matching end tag,
 * found among whole tags (so a `</div>` inside a quoted attribute value is not one), skipping the
 * text of <script>, <style>, <textarea> and <title> and counting nested elements of the same
 * name (inside <svg> or <math>, one that closes itself with `/>` does not nest); or at the end of
 * the page.
 */
function elementEnd(text: string, name: string, from: number, foreign = false): number {
  const tags = /<(\/?)([a-z][a-z0-9-]*)(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  tags.lastIndex = from;
  let depth = 1;
  for (let next = tags.exec(text); next; next = tags.exec(text)) {
    const inner = (next[2] ?? "").toLowerCase();
    // Outside <svg> and <math>, raw text is skipped, and so is a nested <svg> or <math>.
    if (!foreign && !next[1] && RAW_TEXT_ELEMENTS.has(inner)) {
      const close = text.slice(tags.lastIndex).search(new RegExp(`</${inner}[\\s/>]`, "i"));
      if (close < 0) return text.length;
      tags.lastIndex += close;
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
    // A named reference the check cannot decode (`&bsol;`) may stand for any character, `\` or
    // `/` included, so the file it names is unknown.
    if (/&[a-z][a-z0-9]*;/i.test(target)) {
      violations.push({
        code: "unknown-reference",
        message:
          "画像のパスに確かめられない文字参照（&名前;）があります。文字のまま書いてください。",
        target,
      });
      continue;
    }
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) {
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
    // An image the reader may not see as an image is checked but never counted.
    if (!ref.uncertain) diagrams++;
  }
  if (diagrams < options.minDiagrams)
    violations.push({
      code: "no-diagram",
      message: `図解が必要です（${options.minDiagrams} 件以上）。図の元データから SVG を作り、本文に埋め込んでください。コードや HTML ブロックの中、4 文字以上字下げした行の画像は数えません。`,
    });
  return { pass: violations.length === 0, diagrams, violations };
}

// ---------------------------------------------------------------------------
// Sensor and CLI.

/** Artifacts a person reviews at a gate; each must explain itself with a diagram. */
export const DIAGRAM_REQUIRED = new Set([
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
