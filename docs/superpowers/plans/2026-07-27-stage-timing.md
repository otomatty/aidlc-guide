# ステージ所要時間の可視化と見積り Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 監査ログからステージ所要時間を導出し、現在ステージの経過と残り所要量を VS Code 拡張とダッシュボードに表示する。

**Architecture:** 新たな記録層は作らない。reader-core が監査ログの `STAGE_STARTED` / `STAGE_COMPLETED` を対にして区間を導出し（純関数）、space 内の全 intent から集めたサンプルの中央値で見積もる。api-core が `GET /api/timings` で配り、dashboard と拡張のステータスバーが表示する。

**Tech Stack:** TypeScript / bun / Vitest / React 19 / Biome

設計文書: [docs/superpowers/specs/2026-07-27-stage-timing-design.md](../specs/2026-07-27-stage-timing-design.md)

## Global Constraints

- `aidlc/spaces/**` および監査ログへの**書き込み禁止**（NFR-1 / C-T2）。テストも実レコードを読むだけ。
- aidlc-workflows コア（`.claude/` 配下のエンジン・ステージ定義・監査ログ形式）を変更しない。
- reader-core は React / MCP SDK / HTTP / WebSocket を import しない（team.md 構造規約1）。
- 公開パース API は `ReadResult` の判別可能ユニオンを返し、境界を越えて throw しない（team.md 構造規約3）。
- 新規ランタイム依存を追加しない（C-T1）。dev-time の devDependency も追加不要。
- Windows Git Bash と macOS の双方で動くこと。パス連結は `node:path` を使い `path.sep` を決め打ちしない（C-T4）。
- 状態表現は色のみに依存させず、記号 + テキストを併用する（project.md rough-mockups 学習）。
- `IDLE_THRESHOLD_MS = 10 * 60_000`（10分）。
- 品質ゲートは `bun run check` の1コマンド。呼び出し側でチェック項目を列挙しない（project.md ci-pipeline 学習）。

---

## File Structure

**新規作成**

| ファイル | 責務 |
|---|---|
| `packages/reader-core/src/timing/derive.ts` | 監査イベント列 → `StageTiming[]` の純関数。時計を読まない |
| `packages/reader-core/src/timing/estimate.ts` | `StageTiming[]` + `WorkflowModel` → `RemainingEstimate` の純関数 |
| `packages/reader-core/src/timing/read.ts` | I/O 境界。`getStageTimings` / `getStageTimingSamples` |
| `packages/reader-core/tests/timing-derive.test.ts` | 導出の単体（合成イベント列 + 実レコードのゴールデン） |
| `packages/reader-core/tests/timing-estimate.test.ts` | 見積りの単体 |
| `packages/reader-core/tests/timing-read.test.ts` | I/O 境界とサンプル収集 |
| `packages/api-core/tests/timings.test.ts` | `/api/timings` ルーティング |
| `packages/dashboard/src/lib/format-duration.ts` | ms → `2h10m` 表記 |
| `packages/dashboard/tests/timings.test.tsx` | 取得・reducer・表示 |
| `docs/perf/2026-07-27-timing-parse.md` | 性能計測の記録 |

**変更**

| ファイル | 変更内容 |
|---|---|
| `packages/shared-types/src/index.ts` | `StageTiming` / `StageEstimate` / `RemainingEstimate` / `TimingsPayload` を追加 |
| `packages/reader-core/src/audit/events.ts` | パースループを `readAllAuditEvents` に切り出す |
| `packages/reader-core/src/index.ts` | timing モジュールの re-export、`Reader.getTimings` を追加 |
| `packages/api-core/src/handlers/read.ts` | `/api/timings` ルートを追加 |
| `packages/dashboard/src/services/api.ts` | `fetchTimings` |
| `packages/dashboard/src/store/state.ts` | `AppState.timings` |
| `packages/dashboard/src/store/reducer.ts` | `timings` アクション |
| `packages/dashboard/src/app/App.tsx` | 初回描画後の取得と変更時の再取得 |
| `packages/dashboard/src/components/NowStrip.tsx` | 経過 / 残りの2フィールド |
| `packages/dashboard/src/components/now-strip-explain.ts` | 2フィールドの HoverCard 解説 |
| `packages/dashboard/src/components/StageRail.tsx` | 行ごとの実績 / 見積り |
| `packages/dashboard/src/components/Header.tsx` | 残り実作業の総量 |
| `packages/vscode-extension/src/status-bar.ts` | ステータスバーに経過 / 残り |

---

### Task 1: 監査ログの全件読み出し

`readAuditEvents` は `limit` で新しい順に切るため timing に使えない。パーサを複製せず、既存ファイル内から全件版を切り出す。

**Files:**
- Modify: `packages/reader-core/src/audit/events.ts:27-78`
- Modify: `packages/reader-core/src/index.ts:20`
- Test: `packages/reader-core/tests/audit.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `readAllAuditEvents(recordDir: string): Promise<ReadResult<AuditEvent[]>>` — 新しい順（timestamp 降順、同着はシャード名昇順）の全件。`readAuditEvents(recordDir, limit)` は既存シグネチャと挙動を維持する。

- [ ] **Step 1: 失敗するテストを書く**

`packages/reader-core/tests/audit.test.ts` の末尾（最後の `});` の直前）に追記する:

```ts
  it("readAllAuditEvents returns every record with no limit applied", async () => {
    const { value } = expectOk(await readAllAuditEvents(RECORD));
    const limited = expectOk(await readAuditEvents(RECORD, 2)).value;
    expect(value).toHaveLength(4);
    expect(value.slice(0, 2)).toEqual(limited);
  });

  it("readAllAuditEvents carries the same shard warning as the limited read", async () => {
    const { warnings } = expectOk(await readAllAuditEvents(RECORD));
    expect(warnings).toEqual(["audit shard skipped: unreadable-shard.md (not-a-file)"]);
  });
```

同ファイル冒頭の import を差し替える:

```ts
import { readAllAuditEvents, readAuditEvents } from "../src/audit/events.ts";
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `bun run test -- audit`
Expected: FAIL — `readAllAuditEvents is not a function`（インポートが解決できない）

- [ ] **Step 3: 最小の実装**

`packages/reader-core/src/audit/events.ts` の `readAuditEvents` 関数（27〜78行）を、以下の2関数で置き換える。関数本体のロジックは既存のまま、`slice` だけを外側に出す:

```ts
/**
 * Newest-first merge across shards, unbounded.
 *
 * A shard that cannot be read is skipped and reported in `warnings` — the
 * remaining shards still produce a usable timeline (failure mode 5 / BR-RC-5).
 */
export async function readAllAuditEvents(recordDir: string): Promise<ReadResult<AuditEvent[]>> {
  const dir = path.join(recordDir, AUDIT_DIRNAME);

  let shards: string[];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    // Selected by name only, not by `isFile()`: anything occupying a shard name
    // that turns out not to be a readable file becomes a visible warning below
    // rather than a silent omission from the timeline.
    shards = entries
      .filter((e) => e.name.endsWith(".md"))
      .map((e) => e.name)
      .sort(); // R-RC-5
  } catch {
    return { ok: true, value: [] }; // no audit dir = no events, not an error
  }

  const events: AuditEvent[] = [];
  const warnings: string[] = [];

  for (const shard of shards) {
    const read = await readBounded(path.join(dir, shard));
    if (!read.ok) {
      warnings.push(`audit shard skipped: ${shard} (${read.reason})`);
      continue;
    }
    for (const block of read.value.split(BLOCK_SEPARATOR)) {
      const event = fieldOf(block, "Event");
      const timestamp = fieldOf(block, "Timestamp");
      // The file header and any prose block carry neither — not a degradation,
      // just not a record.
      if (event === null || timestamp === null) continue;
      events.push({ event, stage: fieldOf(block, "Stage"), timestamp, shard });
    }
  }

  // R-RC-5: timestamp descending, shard name ascending as the tiebreak, so the
  // same filesystem always yields the same order.
  events.sort((a, b) =>
    a.timestamp === b.timestamp
      ? a.shard.localeCompare(b.shard)
      : a.timestamp < b.timestamp
        ? 1
        : -1,
  );

  return warnings.length > 0 ? { ok: true, value: events, warnings } : { ok: true, value: events };
}

/** The bounded read every UI surface uses. `limit <= 0` yields an empty timeline. */
export async function readAuditEvents(
  recordDir: string,
  limit: number,
): Promise<ReadResult<AuditEvent[]>> {
  const all = await readAllAuditEvents(recordDir);
  if (!("ok" in all)) return all;
  const value = limit > 0 ? all.value.slice(0, limit) : [];
  return all.warnings === undefined
    ? { ok: true, value }
    : { ok: true, value, warnings: all.warnings };
}
```

`packages/reader-core/src/index.ts:20` を差し替える:

```ts
export { readAllAuditEvents, readAuditEvents } from "./audit/events.ts";
```

- [ ] **Step 4: テストが通ることを確認**

Run: `bun run test -- audit`
Expected: PASS — 新規2件を含め、既存の `readAuditEvents` テストがすべて通る

- [ ] **Step 5: コミット**

```bash
git add packages/reader-core/src/audit/events.ts packages/reader-core/src/index.ts packages/reader-core/tests/audit.test.ts
git commit -m "refactor(reader-core): 監査ログの全件読み出しを readAllAuditEvents に切り出す"
```

---

### Task 2: 区間導出（純関数 + 型）

`STAGE_STARTED` / `STAGE_COMPLETED` を対にして `StageTiming[]` を作る。時計は読まず `now` を引数で受ける。

**Files:**
- Modify: `packages/shared-types/src/index.ts`（`AuditEvent` の定義直後に追記）
- Create: `packages/reader-core/src/timing/derive.ts`
- Test: `packages/reader-core/tests/timing-derive.test.ts`

**Interfaces:**
- Consumes: `AuditEvent`（`{ event, stage, timestamp, shard }`）
- Produces:
  - `StageTiming { stage: string; startedAt: string; endedAt: string | null; wallMs: number; activeMs: number; eventCount: number }`
  - `IDLE_THRESHOLD_MS: number`（= 600000）
  - `deriveStageTimings(events: readonly AuditEvent[], now: number): { timings: StageTiming[]; warnings: string[] }`

- [ ] **Step 1: 型を追加**

`packages/shared-types/src/index.ts` の `AuditEvent` インターフェース（111〜119行）の直後に追記する:

```ts
/**
 * One `STAGE_STARTED` → `STAGE_COMPLETED` run, derived from the audit log.
 * Nothing new is recorded: the audit log is already the durable record.
 */
export interface StageTiming {
  stage: string;
  /** ISO 8601, verbatim from the `STAGE_STARTED` record. */
  startedAt: string;
  /** `null` while the run is still open. */
  endedAt: string | null;
  /** `(endedAt ?? now) - startedAt`. */
  wallMs: number;
  /**
   * Idle-trimmed estimate of hands-on time: the sum of gaps between
   * consecutive audit events, each capped at IDLE_THRESHOLD_MS.
   */
  activeMs: number;
  /** Audit events inside the run — the confidence signal for an estimate. */
  eventCount: number;
}
```

- [ ] **Step 2: 失敗するテストを書く**

Create `packages/reader-core/tests/timing-derive.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AuditEvent } from "@aidlc-guide/shared-types";
import { deriveStageTimings, IDLE_THRESHOLD_MS } from "../src/timing/derive.ts";
import { readAllAuditEvents } from "../src/audit/events.ts";
import { expectOk, REAL_RECORD } from "./paths.ts";

const T0 = Date.parse("2026-07-20T00:00:00Z");

/** Newest-first, like readAllAuditEvents — derive must sort for itself. */
function events(...rows: Array<[event: string, stage: string | null, offsetMin: number]>) {
  return rows
    .map(([event, stage, offsetMin]) => ({
      event,
      stage,
      timestamp: new Date(T0 + offsetMin * 60_000).toISOString(),
      shard: "a.md",
    }))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)) satisfies AuditEvent[];
}

const NOW = T0 + 60 * 60_000;

describe("deriveStageTimings", () => {
  it("pairs a start with its completion", () => {
    const { timings, warnings } = deriveStageTimings(
      events(["STAGE_STARTED", "alpha", 0], ["ARTIFACT_CREATED", null, 3], ["STAGE_COMPLETED", "alpha", 5]),
      NOW,
    );
    expect(warnings).toEqual([]);
    expect(timings).toEqual([
      {
        stage: "alpha",
        startedAt: "2026-07-20T00:00:00.000Z",
        endedAt: "2026-07-20T00:05:00.000Z",
        wallMs: 5 * 60_000,
        activeMs: 5 * 60_000,
        eventCount: 2,
      },
    ]);
  });

  it("leaves an unfinished run open and measures it against now", () => {
    const { timings } = deriveStageTimings(
      events(["STAGE_STARTED", "alpha", 0], ["ARTIFACT_CREATED", null, 4]),
      NOW,
    );
    expect(timings[0]?.endedAt).toBeNull();
    expect(timings[0]?.wallMs).toBe(60 * 60_000);
    expect(timings[0]?.activeMs).toBe(4 * 60_000);
  });

  it("caps a gap at the idle threshold instead of dropping it", () => {
    const under = deriveStageTimings(
      events(["STAGE_STARTED", "a", 0], ["STAGE_COMPLETED", "a", 9]),
      NOW,
    );
    const exact = deriveStageTimings(
      events(["STAGE_STARTED", "a", 0], ["STAGE_COMPLETED", "a", 10]),
      NOW,
    );
    const over = deriveStageTimings(
      events(["STAGE_STARTED", "a", 0], ["STAGE_COMPLETED", "a", 30]),
      NOW,
    );
    expect(under.timings[0]?.activeMs).toBe(9 * 60_000);
    expect(exact.timings[0]?.activeMs).toBe(IDLE_THRESHOLD_MS);
    expect(over.timings[0]?.activeMs).toBe(IDLE_THRESHOLD_MS);
    expect(over.timings[0]?.wallMs).toBe(30 * 60_000);
  });

  it("reports zero active time for a run with no events after the start", () => {
    const { timings } = deriveStageTimings(events(["STAGE_STARTED", "a", 0]), T0);
    expect(timings[0]?.activeMs).toBe(0);
    expect(timings[0]?.eventCount).toBe(0);
  });

  it("abandons a run when the same stage starts again", () => {
    const { timings, warnings } = deriveStageTimings(
      events(["STAGE_STARTED", "a", 0], ["STAGE_STARTED", "a", 5], ["STAGE_COMPLETED", "a", 9]),
      NOW,
    );
    expect(timings).toHaveLength(1);
    expect(timings[0]?.startedAt).toBe("2026-07-20T00:05:00.000Z");
    expect(warnings).toEqual(["stage run abandoned without completion: a"]);
  });

  it("warns on a completion with no open run", () => {
    const { timings, warnings } = deriveStageTimings(events(["STAGE_COMPLETED", "a", 0]), NOW);
    expect(timings).toEqual([]);
    expect(warnings).toEqual(["STAGE_COMPLETED without STAGE_STARTED: a"]);
  });

  it("warns when a completion names a different stage than the open run", () => {
    const { timings, warnings } = deriveStageTimings(
      events(["STAGE_STARTED", "a", 0], ["STAGE_COMPLETED", "b", 5], ["STAGE_COMPLETED", "a", 6]),
      NOW,
    );
    expect(timings).toHaveLength(1);
    expect(warnings).toEqual(["STAGE_COMPLETED for b while a was open"]);
  });

  it("skips a start with no stage name", () => {
    const { timings, warnings } = deriveStageTimings(events(["STAGE_STARTED", null, 0]), NOW);
    expect(timings).toEqual([]);
    expect(warnings).toEqual(["STAGE_STARTED with no Stage field at 2026-07-20T00:00:00.000Z"]);
  });

  it("skips an unparseable timestamp", () => {
    const { timings, warnings } = deriveStageTimings(
      [{ event: "STAGE_STARTED", stage: "a", timestamp: "not-a-date", shard: "a.md" }],
      NOW,
    );
    expect(timings).toEqual([]);
    expect(warnings).toEqual(["unparseable timestamp: not-a-date"]);
  });

  it("clamps wallMs to zero when now precedes the start (clock skew)", () => {
    const { timings, warnings } = deriveStageTimings(events(["STAGE_STARTED", "a", 10]), T0);
    expect(timings[0]?.wallMs).toBe(0);
    expect(warnings).toEqual(["clock skew: run a starts after now, wallMs clamped to 0"]);
  });

  it("returns nothing for an empty timeline", () => {
    expect(deriveStageTimings([], NOW)).toEqual({ timings: [], warnings: [] });
  });

  // Structural invariants only, no exact durations: the real record grows every
  // time /aidlc runs, and team.md wants exact-value goldens pinned to a
  // snapshot. What this record uniquely exercises is 21 consecutive runs whose
  // STAGE_COMPLETED and the next STAGE_STARTED share a timestamp to the second
  // — the case the stable-sort tie-break exists for.
  it("golden: the real record's runs are closed, ordered and contiguous", async () => {
    const { value } = expectOk(await readAllAuditEvents(REAL_RECORD));
    const { timings } = deriveStageTimings(value, Date.parse("2026-07-26T00:00:00Z"));
    const first21 = timings.slice(0, 21);

    expect(timings.length).toBeGreaterThanOrEqual(21);
    expect(first21.every((t) => t.endedAt !== null)).toBe(true);
    expect(timings.every((t) => t.activeMs <= t.wallMs)).toBe(true);
    expect(timings.every((t) => t.activeMs >= 0 && t.wallMs >= 0)).toBe(true);
    expect(first21.slice(0, 5).map((t) => t.stage)).toEqual([
      "workspace-scaffold",
      "workspace-detection",
      "state-init",
      "intent-capture",
      "feasibility",
    ]);
    // Each run starts exactly where the previous one ended. This is what breaks
    // if the same-second ordering regresses.
    for (const [index, run] of first21.slice(1).entries()) {
      expect(run.startedAt).toBe(first21[index]?.endedAt);
    }
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `bun run test -- timing-derive`
Expected: FAIL — `Cannot find module '../src/timing/derive.ts'`

- [ ] **Step 4: 実装**

Create `packages/reader-core/src/timing/derive.ts`:

```ts
import type { AuditEvent, StageTiming } from "@aidlc-guide/shared-types";

/**
 * L3 — stage run derivation. Pure: no filesystem, no clock. `now` is injected
 * so an open run measures deterministically under test.
 *
 * Nothing is recorded to produce this. The audit log already holds every
 * STAGE_STARTED/STAGE_COMPLETED pair; this only pairs them up.
 */

/**
 * Gaps longer than this are treated as the human being away.
 *
 * ponytail: each gap is CAPPED at this value rather than dropped. A stage that
 * spends 26 minutes on one silent generation emits few audit events; dropping
 * over-threshold gaps would report it as ~1 minute and erase the very number
 * this feature exists to show. Capping bounds the error at one threshold per
 * gap in both directions. Tune if stages start emitting events on a different
 * cadence.
 */
export const IDLE_THRESHOLD_MS = 10 * 60_000;

interface OpenRun {
  stage: string;
  startedAt: string;
  startMs: number;
  prevMs: number;
  activeMs: number;
  eventCount: number;
}

/**
 * Ascending by parsed time, shard name as the tiebreak.
 *
 * `Array.prototype.sort` is stable, so records sharing a timestamp *and* a
 * shard keep append order — which matters: the engine stamps a stage's
 * STAGE_COMPLETED and the next stage's STAGE_STARTED with the same second, and
 * only append order says which came first.
 */
function ascending(a: AuditEvent, b: AuditEvent): number {
  const delta = Date.parse(a.timestamp) - Date.parse(b.timestamp);
  return delta !== 0 ? delta : a.shard.localeCompare(b.shard);
}

export function deriveStageTimings(
  events: readonly AuditEvent[],
  now: number,
): { timings: StageTiming[]; warnings: string[] } {
  const timings: StageTiming[] = [];
  const warnings: string[] = [];
  let open: OpenRun | null = null;

  for (const event of [...events].sort(ascending)) {
    const at = Date.parse(event.timestamp);
    if (Number.isNaN(at)) {
      warnings.push(`unparseable timestamp: ${event.timestamp}`);
      continue;
    }

    if (event.event === "STAGE_STARTED") {
      if (event.stage === null) {
        warnings.push(`STAGE_STARTED with no Stage field at ${event.timestamp}`);
        continue;
      }
      if (open !== null) warnings.push(`stage run abandoned without completion: ${open.stage}`);
      open = {
        stage: event.stage,
        startedAt: event.timestamp,
        startMs: at,
        prevMs: at,
        activeMs: 0,
        eventCount: 0,
      };
      continue;
    }

    if (open === null) {
      if (event.event === "STAGE_COMPLETED") {
        warnings.push(`STAGE_COMPLETED without STAGE_STARTED: ${event.stage}`);
      }
      continue;
    }

    open.activeMs += Math.min(at - open.prevMs, IDLE_THRESHOLD_MS);
    open.prevMs = at;
    open.eventCount += 1;

    if (event.event === "STAGE_COMPLETED") {
      if (event.stage !== open.stage) {
        warnings.push(`STAGE_COMPLETED for ${event.stage} while ${open.stage} was open`);
        continue;
      }
      timings.push({
        stage: open.stage,
        startedAt: open.startedAt,
        endedAt: event.timestamp,
        wallMs: at - open.startMs,
        activeMs: open.activeMs,
        eventCount: open.eventCount,
      });
      open = null;
    }
  }

  if (open !== null) {
    // The reader's clock and the writer's clock are not the same clock; a
    // negative elapsed is skew, not a negative duration.
    if (now < open.startMs) {
      warnings.push(`clock skew: run ${open.stage} starts after now, wallMs clamped to 0`);
    }
    timings.push({
      stage: open.stage,
      startedAt: open.startedAt,
      endedAt: null,
      wallMs: Math.max(0, now - open.startMs),
      activeMs: open.activeMs,
      eventCount: open.eventCount,
    });
  }

  return { timings, warnings };
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `bun run test -- timing-derive`
Expected: PASS（13件）

ゴールデンが落ちた場合は**実装を曲げず**、実際の導出結果を確認してから原因を判断する（監査ログの追記で件数が増えるのは想定内、順序や連続性が崩れるのは実装のバグ）:

```bash
bun -e 'const {readAllAuditEvents}=await import("./packages/reader-core/src/audit/events.ts");const {deriveStageTimings}=await import("./packages/reader-core/src/timing/derive.ts");const r=await readAllAuditEvents("aidlc/spaces/default/intents/260720-aidlc-guide-prd");console.table(deriveStageTimings(r.value,Date.parse("2026-07-26T00:00:00Z")).timings)'
```

- [ ] **Step 6: コミット**

```bash
git add packages/shared-types/src/index.ts packages/reader-core/src/timing/derive.ts packages/reader-core/tests/timing-derive.test.ts
git commit -m "feat(reader-core): 監査ログからステージ区間を導出する"
```

---

### Task 3: サンプル収集（I/O 境界）

1 intent 分の導出と、space 内の全 intent を横断したサンプル収集。

**Files:**
- Create: `packages/reader-core/src/timing/read.ts`
- Test: `packages/reader-core/tests/timing-read.test.ts`

**Interfaces:**
- Consumes: `readAllAuditEvents(recordDir)`、`deriveStageTimings(events, now)`、`resolveIntents(rootPath)`、`intentsDirOf(rootPath, space)`
- Produces:
  - `getStageTimings(recordDir: string, now: number): Promise<ReadResult<StageTiming[]>>`
  - `getStageTimingSamples(rootPath: string, now: number): Promise<ReadResult<StageTiming[]>>`

- [ ] **Step 1: 失敗するテストを書く**

Create `packages/reader-core/tests/timing-read.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getStageTimings, getStageTimingSamples } from "../src/timing/read.ts";
import { expectOk, fixture, REAL_RECORD, REPO_ROOT } from "./paths.ts";

const NOW = Date.parse("2026-07-26T00:00:00Z");

describe("getStageTimings", () => {
  // The `record` fixture opens `feasibility` at 11:00 and never closes it; the
  // 12:00 STAGE_COMPLETED names `intent-capture`, so it counts as activity but
  // closes nothing. Both facts are asserted here.
  it("derives runs from a record's audit shards", async () => {
    const { value } = expectOk(await getStageTimings(fixture("record"), NOW));
    expect(value).toEqual([
      {
        stage: "feasibility",
        startedAt: "2026-07-20T11:00:00Z",
        endedAt: null,
        wallMs: NOW - Date.parse("2026-07-20T11:00:00Z"),
        activeMs: 10 * 60_000,
        eventCount: 2,
      },
    ]);
  });

  it("passes both shard warnings and derivation warnings through", async () => {
    const { warnings } = expectOk(await getStageTimings(fixture("record"), NOW));
    expect(warnings).toEqual([
      "audit shard skipped: unreadable-shard.md (not-a-file)",
      "STAGE_COMPLETED for intent-capture while feasibility was open",
    ]);
  });

  it("returns an empty list when the record has no audit directory", async () => {
    const result = expectOk(await getStageTimings(fixture("golden"), NOW));
    expect(result.value).toEqual([]);
    expect(result.warnings).toBeUndefined();
  });

  it("reads the real record without writing to it", async () => {
    const { value } = expectOk(await getStageTimings(REAL_RECORD, NOW));
    expect(value.length).toBeGreaterThanOrEqual(21);
  });
});

describe("getStageTimingSamples", () => {
  it("concatenates every intent in the active space", async () => {
    const { value } = expectOk(await getStageTimingSamples(REPO_ROOT, NOW));
    expect(value.map((t) => t.stage)).toContain("code-generation");
  });

  it("returns an empty list when the workspace has no intents", async () => {
    const result = expectOk(await getStageTimingSamples(fixture("golden"), NOW));
    expect(result.value).toEqual([]);
  });

  it("prefixes each intent's warnings with the intent name", async () => {
    const { warnings } = expectOk(await getStageTimingSamples(REPO_ROOT, NOW));
    // The real space has one intent; assert the prefix rather than the content,
    // which changes whenever the workflow advances.
    for (const warning of warnings ?? []) {
      expect(warning.startsWith("260720-aidlc-guide-prd: ")).toBe(true);
    }
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `bun run test -- timing-read`
Expected: FAIL — `Cannot find module '../src/timing/read.ts'`

- [ ] **Step 3: 実装**

Create `packages/reader-core/src/timing/read.ts`:

```ts
import path from "node:path";
import type { ReadResult, StageTiming } from "@aidlc-guide/shared-types";
import { readAllAuditEvents } from "../audit/events.ts";
import { intentsDirOf, resolveIntents } from "../intents/resolve.ts";
import { deriveStageTimings } from "./derive.ts";

/** L3 — the I/O boundary around the pure derivation. Never throws (BR-RC-2). */

function withWarnings(
  value: StageTiming[],
  warnings: readonly string[],
): ReadResult<StageTiming[]> {
  return warnings.length > 0 ? { ok: true, value, warnings: [...warnings] } : { ok: true, value };
}

export async function getStageTimings(
  recordDir: string,
  now: number,
): Promise<ReadResult<StageTiming[]>> {
  const events = await readAllAuditEvents(recordDir);
  if (!("ok" in events)) return events;
  const { timings, warnings } = deriveStageTimings(events.value, now);
  return withWarnings(timings, [...(events.warnings ?? []), ...warnings]);
}

/**
 * Every intent in the active space, concatenated — the sample pool an estimate
 * draws on. An intent that cannot be read is a warning, not a failure: a
 * partial pool still estimates (BR-RC-5).
 */
export async function getStageTimingSamples(
  rootPath: string,
  now: number,
): Promise<ReadResult<StageTiming[]>> {
  const intents = await resolveIntents(rootPath);
  if (!("ok" in intents)) return intents;

  const dir = intentsDirOf(rootPath, intents.value.space);
  const samples: StageTiming[] = [];
  const warnings: string[] = [];

  for (const name of intents.value.all) {
    const read = await getStageTimings(path.join(dir, name), now);
    if (!("ok" in read)) {
      warnings.push(`intent skipped: ${name}`);
      continue;
    }
    samples.push(...read.value);
    for (const warning of read.warnings ?? []) warnings.push(`${name}: ${warning}`);
  }

  return withWarnings(samples, warnings);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `bun run test -- timing-read`
Expected: PASS（7件）

- [ ] **Step 5: 実レコードが汚れていないことを確認**

Run: `git status --porcelain aidlc/`
Expected: 出力なし（テストは読むだけ、NFR-1）

- [ ] **Step 6: コミット**

```bash
git add packages/reader-core/src/timing/read.ts packages/reader-core/tests/timing-read.test.ts
git commit -m "feat(reader-core): space 内の全 intent からステージ実績を集める"
```

---

### Task 4: 見積り（純関数 + 型）

**Files:**
- Modify: `packages/shared-types/src/index.ts`（Task 2 で追加した `StageTiming` の直後）
- Create: `packages/reader-core/src/timing/estimate.ts`
- Test: `packages/reader-core/tests/timing-estimate.test.ts`

**Interfaces:**
- Consumes: `StageTiming[]`、`WorkflowModel`（`stages: StageInfo[]`、`currentStage`）
- Produces:
  - `StageEstimate { stage: string; estimateMs: number | null; rangeMs: [number, number] | null; sampleCount: number; basis: "stage" | "phase" | "global" | "none" }`
  - `RemainingEstimate { currentStage: { stage: string; elapsedActiveMs: number; remainingMs: number | null } | null; pendingStages: StageEstimate[]; totalRemainingMs: number | null; lowConfidence: boolean }`
  - `estimateRemaining(samples: readonly StageTiming[], workflow: WorkflowModel): RemainingEstimate`

- [ ] **Step 1: 型を追加**

`packages/shared-types/src/index.ts` の `StageTiming` インターフェースの直後に追記する:

```ts
/**
 * How long a stage is expected to take, and on what evidence.
 *
 * `basis` is the fallback rung that produced it: this stage's own history,
 * its phase's, the whole workspace's, or nothing at all. The UI shows it —
 * an estimate the caller cannot audit is worse than no estimate.
 */
export interface StageEstimate {
  stage: string;
  estimateMs: number | null;
  /** `[min, max]` of the samples. `null` below two samples — a range of one. */
  rangeMs: [number, number] | null;
  sampleCount: number;
  basis: "stage" | "phase" | "global" | "none";
}

export interface RemainingEstimate {
  currentStage: {
    stage: string;
    elapsedActiveMs: number;
    remainingMs: number | null;
  } | null;
  /** EXECUTE stages that are neither completed, skipped, nor the current one. */
  pendingStages: StageEstimate[];
  /**
   * Hands-on work left, not a wall-clock completion time — see the spec: the
   * wall clock is set by when the human sits down, which is not predictable.
   * `null` only when nothing at all could be estimated.
   */
  totalRemainingMs: number | null;
  /** Any estimate rests on a fallback rung or on a single sample. */
  lowConfidence: boolean;
}

/** `GET /api/timings` success body. */
export interface TimingsPayload {
  /** The active record's runs — the actuals shown on the stage rail. */
  timings: StageTiming[];
  remaining: RemainingEstimate;
}
```

- [ ] **Step 2: 失敗するテストを書く**

Create `packages/reader-core/tests/timing-estimate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { StageInfo, StageTiming, WorkflowModel } from "@aidlc-guide/shared-types";
import { estimateRemaining } from "../src/timing/estimate.ts";

function stage(slug: string, over: Partial<StageInfo> = {}): StageInfo {
  return { slug, phase: "CONSTRUCTION", execution: "EXECUTE", status: "not-started", ...over };
}

function workflow(over: Partial<WorkflowModel> = {}): WorkflowModel {
  return {
    project: "p",
    scope: "feature",
    depth: "practical",
    stateVersion: 7,
    phase: "CONSTRUCTION",
    currentStage: null,
    nextStage: null,
    gate: null,
    stages: [],
    done: 0,
    total: 0,
    ...over,
  };
}

function run(stageName: string, activeMs: number, open = false): StageTiming {
  return {
    stage: stageName,
    startedAt: "2026-07-20T00:00:00Z",
    endedAt: open ? null : "2026-07-20T01:00:00Z",
    wallMs: activeMs * 2,
    activeMs,
    eventCount: 50,
  };
}

describe("estimateRemaining", () => {
  it("uses the stage's own history and reports no range for one sample", () => {
    const result = estimateRemaining(
      [run("a", 600_000)],
      workflow({ stages: [stage("a"), stage("b")], currentStage: "b" }),
    );
    const a = result.pendingStages.find((s) => s.stage === "a");
    expect(a).toEqual({
      stage: "a",
      estimateMs: 600_000,
      rangeMs: null,
      sampleCount: 1,
      basis: "stage",
    });
  });

  it("takes the median, and averages the two middles when even", () => {
    const odd = estimateRemaining(
      [run("a", 100), run("a", 500), run("a", 900)],
      workflow({ stages: [stage("a")] }),
    );
    expect(odd.pendingStages[0]?.estimateMs).toBe(500);
    expect(odd.pendingStages[0]?.rangeMs).toEqual([100, 900]);

    const even = estimateRemaining(
      [run("a", 100), run("a", 200), run("a", 400), run("a", 900)],
      workflow({ stages: [stage("a")] }),
    );
    expect(even.pendingStages[0]?.estimateMs).toBe(300);
  });

  it("falls back to the phase median when the stage has no history", () => {
    const result = estimateRemaining(
      [run("a", 100), run("b", 300)],
      workflow({ stages: [stage("a", { status: "completed" }), stage("b", { status: "completed" }), stage("c")] }),
    );
    expect(result.pendingStages[0]).toMatchObject({ stage: "c", estimateMs: 200, basis: "phase" });
  });

  it("falls back to the global median when the phase has no history either", () => {
    const result = estimateRemaining(
      [run("a", 100), run("a", 300)],
      workflow({
        stages: [stage("a", { phase: "IDEATION", status: "completed" }), stage("z", { phase: "OPERATION" })],
      }),
    );
    expect(result.pendingStages[0]).toMatchObject({ stage: "z", estimateMs: 200, basis: "global" });
  });

  it("reports basis none with a null estimate when there is no history at all", () => {
    const result = estimateRemaining([], workflow({ stages: [stage("a")] }));
    expect(result.pendingStages[0]).toEqual({
      stage: "a",
      estimateMs: null,
      rangeMs: null,
      sampleCount: 0,
      basis: "none",
    });
    expect(result.totalRemainingMs).toBeNull();
  });

  it("excludes SKIP, completed, skipped and the current stage from pending", () => {
    const result = estimateRemaining(
      [run("x", 100)],
      workflow({
        currentStage: "cur",
        stages: [
          stage("cur", { status: "in-progress" }),
          stage("skipme", { execution: "SKIP" }),
          stage("done", { status: "completed" }),
          stage("gone", { status: "skipped" }),
          stage("todo"),
        ],
      }),
    );
    expect(result.pendingStages.map((s) => s.stage)).toEqual(["todo"]);
  });

  it("measures the open run's elapsed time and subtracts it from the estimate", () => {
    const result = estimateRemaining(
      [run("a", 600_000), run("a", 400_000, true)],
      workflow({ currentStage: "a", stages: [stage("a", { status: "in-progress" })] }),
    );
    expect(result.currentStage).toEqual({
      stage: "a",
      elapsedActiveMs: 400_000,
      remainingMs: 200_000,
    });
  });

  it("never reports a negative remaining", () => {
    const result = estimateRemaining(
      [run("a", 100_000), run("a", 900_000, true)],
      workflow({ currentStage: "a", stages: [stage("a", { status: "in-progress" })] }),
    );
    expect(result.currentStage?.remainingMs).toBe(0);
  });

  it("sums the current remainder and the pending estimates", () => {
    const result = estimateRemaining(
      [run("a", 600_000), run("b", 300_000), run("a", 100_000, true)],
      workflow({
        currentStage: "a",
        stages: [stage("a", { status: "in-progress" }), stage("b"), stage("c")],
      }),
    );
    // a: 600k - 100k = 500k, b: 300k, c: phase median of (600k, 300k) = 450k
    expect(result.totalRemainingMs).toBe(1_250_000);
  });

  it("flags low confidence on a fallback rung or a single sample", () => {
    const single = estimateRemaining([run("a", 100)], workflow({ stages: [stage("a")] }));
    expect(single.lowConfidence).toBe(true);

    const solid = estimateRemaining(
      [run("a", 100), run("a", 200)],
      workflow({ stages: [stage("a")] }),
    );
    expect(solid.lowConfidence).toBe(false);
  });

  it("reports a null current stage when the workflow names none", () => {
    expect(estimateRemaining([], workflow()).currentStage).toBeNull();
  });

  it("ignores open runs when building the sample pool", () => {
    const result = estimateRemaining(
      [run("a", 999_999, true)],
      workflow({ stages: [stage("a")] }),
    );
    expect(result.pendingStages[0]?.basis).toBe("none");
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `bun run test -- timing-estimate`
Expected: FAIL — `Cannot find module '../src/timing/estimate.ts'`

- [ ] **Step 4: 実装**

Create `packages/reader-core/src/timing/estimate.ts`:

```ts
import type {
  Phase,
  RemainingEstimate,
  StageEstimate,
  StageTiming,
  WorkflowModel,
} from "@aidlc-guide/shared-types";

/**
 * L3 — estimation. Pure: no filesystem, no clock. Every duration here is
 * `activeMs`, never wall clock (see the spec: wall clock measures when the
 * human sat down, not how much work a stage takes).
 */

/** Median, not mean: measured runs span 13 minutes to 8 hours. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  // Non-null assertions are safe: callers only reach here with a non-empty list.
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : (((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

function push(into: Map<string, number[]>, key: string, value: number): void {
  const bucket = into.get(key);
  if (bucket === undefined) into.set(key, [value]);
  else bucket.push(value);
}

function estimateFrom(
  stage: string,
  values: readonly number[],
  basis: StageEstimate["basis"],
): StageEstimate {
  return {
    stage,
    estimateMs: median(values),
    rangeMs: values.length >= 2 ? [Math.min(...values), Math.max(...values)] : null,
    sampleCount: values.length,
    basis,
  };
}

export function estimateRemaining(
  samples: readonly StageTiming[],
  workflow: WorkflowModel,
): RemainingEstimate {
  const phaseOf = new Map<string, Phase>(workflow.stages.map((s) => [s.slug, s.phase]));

  const byStage = new Map<string, number[]>();
  const byPhase = new Map<string, number[]>();
  const global: number[] = [];

  for (const sample of samples) {
    // Open runs are in progress, not evidence of how long the stage takes.
    if (sample.endedAt === null) continue;
    push(byStage, sample.stage, sample.activeMs);
    global.push(sample.activeMs);
    const phase = phaseOf.get(sample.stage);
    if (phase !== undefined) push(byPhase, phase, sample.activeMs);
  }

  const estimate = (stage: string): StageEstimate => {
    const own = byStage.get(stage);
    if (own !== undefined && own.length > 0) return estimateFrom(stage, own, "stage");
    const phase = phaseOf.get(stage);
    const inPhase = phase === undefined ? undefined : byPhase.get(phase);
    if (inPhase !== undefined && inPhase.length > 0) return estimateFrom(stage, inPhase, "phase");
    if (global.length > 0) return estimateFrom(stage, global, "global");
    return { stage, estimateMs: null, rangeMs: null, sampleCount: 0, basis: "none" };
  };

  const pendingStages = workflow.stages
    .filter(
      (s) =>
        s.execution === "EXECUTE" &&
        s.status !== "completed" &&
        s.status !== "skipped" &&
        s.slug !== workflow.currentStage,
    )
    .map((s) => estimate(s.slug));

  const currentEstimate =
    workflow.currentStage === null ? null : estimate(workflow.currentStage);
  const openRun = samples.find(
    (s) => s.endedAt === null && s.stage === workflow.currentStage,
  );
  const elapsedActiveMs = openRun?.activeMs ?? 0;
  const currentRemaining =
    currentEstimate === null || currentEstimate.estimateMs === null
      ? null
      : Math.max(0, currentEstimate.estimateMs - elapsedActiveMs);

  const currentStage =
    workflow.currentStage === null
      ? null
      : { stage: workflow.currentStage, elapsedActiveMs, remainingMs: currentRemaining };

  const parts = [
    ...(currentRemaining === null ? [] : [currentRemaining]),
    ...pendingStages.flatMap((s) => (s.estimateMs === null ? [] : [s.estimateMs])),
  ];

  const rungs = [...(currentEstimate === null ? [] : [currentEstimate]), ...pendingStages];

  return {
    currentStage,
    pendingStages,
    totalRemainingMs: parts.length === 0 ? null : parts.reduce((a, b) => a + b, 0),
    lowConfidence: rungs.some((s) => s.basis !== "stage" || s.sampleCount < 2),
  };
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `bun run test -- timing-estimate`
Expected: PASS（12件）

- [ ] **Step 6: コミット**

```bash
git add packages/shared-types/src/index.ts packages/reader-core/src/timing/estimate.ts packages/reader-core/tests/timing-estimate.test.ts
git commit -m "feat(reader-core): ステージ実績の中央値から残り所要量を見積もる"
```

---

### Task 5: Reader メソッドと `/api/timings`

**Files:**
- Modify: `packages/reader-core/src/index.ts:44-53`（`Reader` インターフェース）、`packages/reader-core/src/index.ts:96-167`（`createReader` の返り値）、re-export 群
- Modify: `packages/api-core/src/handlers/read.ts:115`（ルート追加）
- Test: `packages/api-core/tests/timings.test.ts`

**Interfaces:**
- Consumes: `getStageTimings`、`getStageTimingSamples`、`estimateRemaining`、`TimingsPayload`
- Produces:
  - `Reader.getTimings(now?: number): Promise<ReadResult<TimingsPayload>>`
  - `GET /api/timings` → `ReadResult<TimingsPayload>`（`mapResultRoute` 経由なので `unsupported` / `error` もそのまま 200 で返る）

- [ ] **Step 1: 失敗するテストを書く**

Create `packages/api-core/tests/timings.test.ts`:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createGuideService } from "../src/service.ts";
import { routeRead } from "../src/handlers/read.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function route(pathname: string) {
  return new URL(`http://localhost${pathname}`);
}

describe("GET /api/timings", () => {
  it("returns the active record's runs and a remaining estimate", async () => {
    const service = createGuideService({ workspaceRoot: REPO_ROOT });
    const result = await routeRead(service.readContext, route("/api/timings"));

    expect(result?.status).toBe(200);
    const body = result?.body as { ok: true; value: { timings: unknown[]; remaining: unknown } };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.value.timings)).toBe(true);
    expect(body.value.timings.length).toBeGreaterThanOrEqual(21);
    expect(body.value.remaining).toHaveProperty("pendingStages");
    expect(body.value.remaining).toHaveProperty("lowConfidence");
  });

  it("is not part of the workflow payload (ADR-03 段階的初回描画)", async () => {
    const service = createGuideService({ workspaceRoot: REPO_ROOT });
    const result = await routeRead(service.readContext, route("/api/workflow"));
    expect(result?.body).not.toHaveProperty("timings");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `bun run test -- timings`
Expected: FAIL — `/api/timings` が `{ error: true, reason: "unknown-route" }` を 404 で返す

- [ ] **Step 3: reader-core を実装**

`packages/reader-core/src/index.ts` の import 群（1〜18行）に追記する:

```ts
import { estimateRemaining } from "./timing/estimate.ts";
import { getStageTimings, getStageTimingSamples } from "./timing/read.ts";
```

`TimingsPayload` を `@aidlc-guide/shared-types` からの型 import に加える。

re-export 群（`export { withResult } ...` の直後）に追記する:

```ts
export { deriveStageTimings, IDLE_THRESHOLD_MS } from "./timing/derive.ts";
export { estimateRemaining } from "./timing/estimate.ts";
export { getStageTimings, getStageTimingSamples } from "./timing/read.ts";
```

`Reader` インターフェース（44〜53行）の doc コメントと本体を差し替える:

```ts
/** The eight public methods (component-methods.md). Every one returns ReadResult. */
export interface Reader {
  getWorkflow(): Promise<ReadResult<WorkflowModel>>;
  getMatrix(): Promise<ReadResult<Matrix>>;
  getAuditEvents(limit: number): Promise<ReadResult<AuditEvent[]>>;
  getIntents(): Promise<ReadResult<IntentList>>;
  getNextStep(): Promise<ReadResult<NextStep>>;
  /** `now` is injectable so tests measure an open run deterministically. */
  getTimings(now?: number): Promise<ReadResult<TimingsPayload>>;
  readArtifact(relPath: string): Promise<ReadResult<string>>;
  watch(onChange: (event: WatchEvent) => void, options?: WatchOptions): () => void;
}
```

`createReader` の返り値オブジェクトに、`getNextStep` の直後（136行の `}),` の後）を追記する:

```ts
    getTimings: (now = Date.now()) =>
      withResult(async () => {
        const record = await recordDir();
        if (!("ok" in record)) return record;
        const state = await readState(record.value);
        if (!("ok" in state)) return state;

        // Two passes over the active record — its own runs for the stage rail,
        // the whole space for the estimate's sample pool. A full audit parse is
        // ~15ms, so sharing one pass is not worth threading an intent id
        // through StageTiming.
        const timings = await getStageTimings(record.value, now);
        if (!("ok" in timings)) return timings;
        const samples =
          options.recordDir === undefined
            ? await getStageTimingSamples(rootPath, now)
            : timings;
        if (!("ok" in samples)) return samples;

        const warnings = [...(timings.warnings ?? []), ...(samples.warnings ?? [])];
        const value = {
          timings: timings.value,
          remaining: estimateRemaining(samples.value, state.value),
        };
        return warnings.length > 0 ? { ok: true, value, warnings } : { ok: true, value };
      }),
```

- [ ] **Step 4: api-core にルートを追加**

`packages/api-core/src/handlers/read.ts:115` の `/api/workflow` 行の直後に追記する:

```ts
  // Deliberately its own route, not a key on /api/workflow: a full audit parse
  // must stay off the first-paint critical path (ADR-03 / NFR-2 3秒).
  if (route === "/api/timings") return mapResultRoute(await ctx.reader.getTimings());
```

- [ ] **Step 5: テストが通ることを確認**

Run: `bun run test -- timings`
Expected: PASS（2件）

- [ ] **Step 6: 型検査と既存テストの回帰を確認**

Run: `bun run lint && bunx tsc --noEmit && bun run test`
Expected: すべて PASS。`Reader` を実装する他のモジュール（mcp-server 等）に `getTimings` 未実装のエラーが出たら、そこにも同じ委譲を足す

- [ ] **Step 7: コミット**

```bash
git add packages/reader-core/src/index.ts packages/api-core/src/handlers/read.ts packages/api-core/tests/timings.test.ts
git commit -m "feat(api-core): GET /api/timings で所要時間と見積りを配る"
```

---

### Task 6: dashboard のデータ取得

初回描画のクリティカルパスに載せず、描画後に取得し、変更 push のたびに再取得する。

**Files:**
- Modify: `packages/dashboard/src/services/api.ts`（`fetchDocsSettings` の後）
- Modify: `packages/dashboard/src/store/state.ts`（`AppState` と `initialState`）
- Modify: `packages/dashboard/src/store/reducer.ts`（`Action` と `reducer`）
- Modify: `packages/dashboard/src/app/App.tsx`
- Test: `packages/dashboard/tests/timings.test.tsx`

**Interfaces:**
- Consumes: `GET /api/timings` → `ReadResult<TimingsPayload>`
- Produces:
  - `fetchTimings(): Promise<ReadResult<TimingsPayload>>`
  - `AppState.timings: ViewState<TimingsPayload>`
  - `Action` に `{ type: "timings"; result: ReadResult<TimingsPayload> }`

- [ ] **Step 1: 失敗するテストを書く**

Create `packages/dashboard/tests/timings.test.tsx`:

```ts
import { describe, expect, it } from "vitest";
import type { ReadResult, TimingsPayload } from "@aidlc-guide/shared-types";
import { reducer } from "../src/store/reducer.ts";
import { initialState } from "../src/store/state.ts";

const payload: TimingsPayload = {
  timings: [
    {
      stage: "code-generation",
      startedAt: "2026-07-25T05:41:30Z",
      endedAt: null,
      wallMs: 7_800_000,
      activeMs: 7_200_000,
      eventCount: 1201,
    },
  ],
  remaining: {
    currentStage: { stage: "code-generation", elapsedActiveMs: 7_200_000, remainingMs: 2_700_000 },
    pendingStages: [
      { stage: "build-and-test", estimateMs: 960_000, rangeMs: null, sampleCount: 1, basis: "stage" },
    ],
    totalRemainingMs: 3_660_000,
    lowConfidence: true,
  },
};

describe("timings slice", () => {
  it("starts as loading", () => {
    expect(initialState.timings).toEqual({ kind: "loading" });
  });

  it("stores a successful payload", () => {
    const result: ReadResult<TimingsPayload> = { ok: true, value: payload };
    const next = reducer(initialState, { type: "timings", result });
    expect(next.timings).toEqual({ kind: "success", value: payload });
  });

  it("surfaces a read failure as an error view state", () => {
    const result: ReadResult<TimingsPayload> = { error: true, reason: "state-missing" };
    const next = reducer(initialState, { type: "timings", result });
    expect(next.timings.kind).toBe("error");
  });

  it("keeps warnings as a partial view state", () => {
    const result: ReadResult<TimingsPayload> = {
      ok: true,
      value: payload,
      warnings: ["intent skipped: broken"],
    };
    const next = reducer(initialState, { type: "timings", result });
    expect(next.timings).toEqual({
      kind: "partial",
      value: payload,
      notes: ["intent skipped: broken"],
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `bun run test -- timings.test.tsx`
Expected: FAIL — `initialState.timings` が `undefined`

- [ ] **Step 3: api クライアントを実装**

`packages/dashboard/src/services/api.ts` の import に `TimingsPayload` を足し、`fetchDocsSettings` の直後に追記する:

```ts
export async function fetchTimings(): Promise<ReadResult<TimingsPayload>> {
  const fetched = await getJson("/api/timings");
  return fetched.reached ? asReadResult<TimingsPayload>(fetched.body) : unreachable();
}
```

`refetchAll` には**足さない** — 初回描画の3並列に監査ログの全走査を混ぜないため。

- [ ] **Step 4: store を実装**

`packages/dashboard/src/store/state.ts` の import に `TimingsPayload` を足し、`AppState` の `matrix` の直後に追記する:

```ts
  /**
   * Derived from the audit log, off the first-paint path: it arrives after
   * the three startup slices and refreshes on every change push.
   */
  timings: ViewState<TimingsPayload>;
```

`initialState` の `matrix` の直後に追記する:

```ts
  timings: { kind: "loading" },
```

`packages/dashboard/src/store/reducer.ts` の `Action` union に追記する:

```ts
  | { type: "timings"; result: ReadResult<TimingsPayload> }
```

`reducer` の `case "matrix":` ブロックの直後に追記する:

```ts
    case "timings":
      return { ...state, timings: deriveViewState(action.result) };
```

import に `TimingsPayload` を足す。

- [ ] **Step 5: テストが通ることを確認**

Run: `bun run test -- timings.test.tsx`
Expected: PASS（4件）

- [ ] **Step 6: App から取得する**

`packages/dashboard/src/app/App.tsx` の import 13行目を差し替える:

```tsx
import { fetchIntents, fetchMatrix, fetchTimings, refetchAll } from "../services/api.ts";
```

既存の matrix / intents 用 effect（42〜49行）の直後に、新しい effect を足す。`state` と `dispatch` は同じコンポーネント内の `useAppState()` / `useDispatch()`（28〜29行）から既に取れている:

```tsx
  // Off the first-paint path: this runs after the three startup slices and
  // again on every change push. `lastChangeAt` advances on any scope, not just
  // audit — a ~15ms full parse is cheaper than a scope filter.
  useEffect(() => {
    let cancelled = false;
    void fetchTimings().then((result) => {
      if (!cancelled) dispatch({ type: "timings", result });
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, state.live.lastChangeAt]);
```

- [ ] **Step 7: 回帰を確認**

Run: `bun run test && bunx tsc --noEmit -p packages/dashboard`
Expected: すべて PASS

- [ ] **Step 8: コミット**

```bash
git add packages/dashboard/src/services/api.ts packages/dashboard/src/store/state.ts packages/dashboard/src/store/reducer.ts packages/dashboard/src/app/App.tsx packages/dashboard/tests/timings.test.tsx
git commit -m "feat(dashboard): /api/timings を初回描画後に取得して store に載せる"
```

---

### Task 7: dashboard の表示

**Files:**
- Create: `packages/dashboard/src/lib/format-duration.ts`
- Modify: `packages/dashboard/src/components/NowStrip.tsx`
- Modify: `packages/dashboard/src/components/now-strip-explain.ts`
- Modify: `packages/dashboard/src/components/StageRail.tsx`
- Modify: `packages/dashboard/src/components/Header.tsx`
- Modify: `packages/dashboard/src/app/App.tsx:111-115`（`Header` / `NowStrip` / `StageRail` への props 受け渡し）
- Test: `packages/dashboard/tests/timings.test.tsx`（追記）

**Interfaces:**
- Consumes: `AppState.timings`（`ViewState<TimingsPayload>`）、`viewValue`
- Produces:
  - `formatDuration(ms: number | null): string`
  - `NowStripProps.timings?: TimingsPayload | null`
  - `StageRailProps.timings?: TimingsPayload | null`
  - `HeaderProps.timings?: TimingsPayload | null`
  - `explainNowFields(workflow: WorkflowModel, timings: TimingsPayload | null): NowFields`（第2引数を追加）

- [ ] **Step 1: 失敗するテストを書く**

`packages/dashboard/tests/timings.test.tsx` に追記する:

```ts
import { formatDuration } from "../src/lib/format-duration.ts";

describe("formatDuration", () => {
  it("renders minutes below an hour", () => {
    expect(formatDuration(45 * 60_000)).toBe("45m");
  });

  it("renders hours and zero-padded minutes at or above an hour", () => {
    expect(formatDuration(60 * 60_000)).toBe("1h00m");
    expect(formatDuration(2 * 60 * 60_000 + 10 * 60_000)).toBe("2h10m");
  });

  it("rounds to the nearest minute", () => {
    expect(formatDuration(89_000)).toBe("1m");
    expect(formatDuration(91_000)).toBe("2m");
  });

  it("renders under a minute as a floor rather than 0m", () => {
    expect(formatDuration(5_000)).toBe("<1m");
    expect(formatDuration(0)).toBe("<1m");
  });

  it("renders an em dash for an absent duration", () => {
    expect(formatDuration(null)).toBe("—");
  });
});
```

さらに NowStrip の表示テストを追記する:

```tsx
import { render, screen } from "@testing-library/react";
import { NowStrip } from "../src/components/NowStrip.tsx";

const workflow = {
  project: "p",
  scope: "feature",
  depth: "practical",
  stateVersion: 7 as const,
  phase: "CONSTRUCTION" as const,
  currentStage: "code-generation",
  nextStage: "build-and-test",
  gate: null,
  stages: [],
  done: 18,
  total: 21,
};

describe("NowStrip timing fields", () => {
  it("shows elapsed and remaining, marking the estimate with ≈ and text", () => {
    render(
      <NowStrip
        state={{ kind: "success", value: workflow }}
        onRetry={() => {}}
        timings={payload}
      />,
    );
    expect(screen.getByTestId("now-elapsed")).toHaveTextContent("2h00m");
    const remaining = screen.getByTestId("now-remaining");
    expect(remaining).toHaveTextContent("≈45m");
    expect(remaining).toHaveTextContent("推定");
  });

  it("shows an em dash when no timing data has arrived", () => {
    render(
      <NowStrip state={{ kind: "success", value: workflow }} onRetry={() => {}} timings={null} />,
    );
    expect(screen.getByTestId("now-elapsed")).toHaveTextContent("—");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `bun run test -- timings.test.tsx`
Expected: FAIL — `Cannot find module '../src/lib/format-duration.ts'`

- [ ] **Step 3: フォーマッタを実装**

Create `packages/dashboard/src/lib/format-duration.ts`:

```ts
/**
 * ms → `2h10m` / `45m` / `<1m` / `—`.
 *
 * `<1m` rather than `0m`: a stage that has just started has not taken zero
 * time, and "0m" reads as a broken measurement.
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}
```

- [ ] **Step 4: NowStrip を実装**

`NowStripProps` に追記する:

```ts
  /** `null` until `/api/timings` lands — the strip renders without it. */
  timings?: TimingsPayload | null;
```

`NowStripImpl` は `timings` を `NowStripBody` へ渡す。`NowStripBody` の `done` フィールド（115〜119行）の直後に2フィールドを足す:

```tsx
        <ExplainCard fieldKey="elapsed" label="経過" explain={explain.elapsed}>
          <span data-testid="now-elapsed">
            {formatDuration(timings?.remaining.currentStage?.elapsedActiveMs ?? null)}
          </span>
        </ExplainCard>
        <ExplainCard fieldKey="remaining" label="残り" explain={explain.remaining}>
          <span data-testid="now-remaining">
            {timings?.remaining.currentStage?.remainingMs === undefined ||
            timings.remaining.currentStage.remainingMs === null ? (
              "—"
            ) : (
              <>
                ≈{formatDuration(timings.remaining.currentStage.remainingMs)}
                {/* Symbol + text, never colour alone (project.md rough-mockups). */}
                <span className="now__hint"> 推定</span>
              </>
            )}
          </span>
        </ExplainCard>
```

`packages/dashboard/src/components/now-strip-explain.ts` に2つの関数を足し、`NowFields` インターフェースに `elapsed` と `remaining` を、`explainNowFields` に第2引数を足す:

```ts
export function explainElapsed(elapsedActiveMs: number | null): FieldExplain {
  return {
    definition:
      "現在のステージが始まってからの実作業時間の推定です。10分を超える無操作は待ち時間として差し引いています。",
    current:
      elapsedActiveMs === null
        ? "まだ所要時間を算出できていません（実行中のステージがないか、監査ログを読めていません）。"
        : `いまのステージにこれまで約 ${formatDuration(elapsedActiveMs)} を費やしています。`,
    bullets: [
      "壁時計の経過時間ではありません — 離席や夜間の中断は含めていません",
      "監査ログのイベント間隔から算出しています",
      "10分を超える無音の生成は10分として数えられます",
    ],
  };
}

export function explainRemaining(remainingMs: number | null, lowConfidence: boolean): FieldExplain {
  return {
    definition: "同じステージの過去の実績（中央値）から見た、残りの実作業量の推定です。",
    current:
      remainingMs === null
        ? "推定に使える実績がまだありません。"
        : `残り約 ${formatDuration(remainingMs)} の作業量です${lowConfidence ? "（実績が少ないため参考値）" : ""}。`,
    bullets: [
      "完了時刻ではなく作業量です — いつ終わるかは着手のタイミング次第です",
      "実績が1件のみの場合は前回の値そのものです",
      "実績のないステージは同じフェーズの中央値で代用します",
    ],
  };
}
```

`explainNowFields` のシグネチャを `explainNowFields(workflow: WorkflowModel, timings: TimingsPayload | null)` に変え、返り値に次を加える:

```ts
    elapsed: explainElapsed(timings?.remaining.currentStage?.elapsedActiveMs ?? null),
    remaining: explainRemaining(
      timings?.remaining.currentStage?.remainingMs ?? null,
      timings?.remaining.lowConfidence ?? false,
    ),
```

`NowStripBody` の呼び出しを `explainNowFields(workflow, timings ?? null)` に更新する。`formatDuration` を `../lib/format-duration.ts` から import する。

- [ ] **Step 5: StageRail を実装**

`StageRailProps` に追記する:

```ts
  /** `null` until `/api/timings` lands — rows render without durations. */
  timings?: TimingsPayload | null;
```

`StageRail` 本体（`groupStages` を呼んでいるコンポーネント）で、行ごとの表示値を決める関数を組む:

```tsx
const actualByStage = new Map(
  (timings?.timings ?? [])
    .filter((t) => t.endedAt !== null)
    .map((t) => [t.stage, t.activeMs] as const),
);
const estimateByStage = new Map(
  (timings?.remaining.pendingStages ?? []).map((s) => [s.stage, s.estimateMs] as const),
);

/** Actuals win over estimates: a measured run is not a guess. */
function durationOf(slug: string): { text: string; estimated: boolean } | null {
  const actual = actualByStage.get(slug);
  if (actual !== undefined) return { text: formatDuration(actual), estimated: false };
  const estimate = estimateByStage.get(slug);
  if (estimate === undefined || estimate === null) return null;
  return { text: formatDuration(estimate), estimated: true };
}
```

`StageRailItem` に `duration: { text: string; estimated: boolean } | null` を渡し、ステージ名の隣に描画する:

```tsx
{duration === null ? null : (
  <span className="rail__duration" data-testid={`rail-duration-${stage.slug}`}>
    {/* Symbol + text, never colour alone (project.md rough-mockups). */}
    {duration.estimated ? `≈${duration.text} 推定` : duration.text}
  </span>
)}
```

`App.tsx:111` と `App.tsx:115` の `NowStrip` / `StageRail` に `timings={viewValue(state.timings)}` を渡す。

- [ ] **Step 6: ヘッダに残り総量を出す**

`packages/dashboard/tests/timings.test.tsx` に追記する:

```tsx
import { Header } from "../src/components/Header.tsx";

describe("Header total remaining", () => {
  it("shows the total as a work amount, never a completion time", () => {
    render(<Header timings={payload} />);
    const total = screen.getByTestId("header-total-remaining");
    expect(total).toHaveTextContent("残り実作業 ≈1h01m");
    expect(total.textContent).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("renders nothing when the total cannot be estimated", () => {
    render(<Header timings={{ ...payload, remaining: { ...payload.remaining, totalRemainingMs: null } }} />);
    expect(screen.queryByTestId("header-total-remaining")).toBeNull();
  });
});
```

`packages/dashboard/src/components/Header.tsx` に `timings?: TimingsPayload | null` を足し、既存の要素列の末尾に描画する。`Header` の既存 props は変更しない（テストの `render(<Header timings={payload} />)` が通らない場合は、そのファイルの必須 props を補って呼ぶこと）:

```tsx
{timings?.remaining.totalRemainingMs == null ? null : (
  <span className="header__remaining" data-testid="header-total-remaining">
    残り実作業 ≈{formatDuration(timings.remaining.totalRemainingMs)}
    {timings.remaining.lowConfidence ? "（参考値）" : ""}
  </span>
)}
```

`App.tsx` の `Header` にも `timings={viewValue(state.timings)}` を渡す。

- [ ] **Step 7: テストが通ることを確認**

Run: `bun run test -- timings.test.tsx`
Expected: PASS（13件）

- [ ] **Step 8: 既存の表示テストの回帰を確認**

Run: `bun run test && bunx tsc --noEmit -p packages/dashboard`
Expected: すべて PASS。`components.test.tsx` / `now-strip-explain.test.ts` / `header.test.tsx` は `explainNowFields` のシグネチャ変更と新フィールドで落ちる。呼び出しに第2引数 `null` を足し、期待値に新しい2フィールドを含める形へ更新する

- [ ] **Step 9: コミット**

```bash
git add packages/dashboard/src/lib/format-duration.ts packages/dashboard/src/components/NowStrip.tsx packages/dashboard/src/components/now-strip-explain.ts packages/dashboard/src/components/StageRail.tsx packages/dashboard/src/components/Header.tsx packages/dashboard/src/app/App.tsx packages/dashboard/tests
git commit -m "feat(dashboard): 現在ステージの経過とステージ別の実績/見積りを表示する"
```

---

### Task 8: VS Code ステータスバー

ダッシュボードを開かずに現在ステージの経過が見える、最も効くサーフェス。

**Files:**
- Modify: `packages/vscode-extension/src/status-bar.ts:16-30`

**Interfaces:**
- Consumes: `session.service.reader.getTimings()`、`formatDuration` と同じ表記規則
- Produces: なし（表示のみ）

- [ ] **Step 1: 実装**

`packages/vscode-extension/src/status-bar.ts` の `refreshStatusBar`（16〜30行）を差し替える。拡張は dashboard パッケージを import できない（別ビルド）ため、同じ規則の小さなフォーマッタをここに置く:

```ts
/** Mirrors dashboard/src/lib/format-duration.ts — the extension bundle cannot import it. */
function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}

export async function refreshStatusBar(workspaceRoot: string): Promise<void> {
  if (item === undefined) return;
  try {
    const session = getOrCreateSession(workspaceRoot);
    const state = await session.service.reader.getWorkflow();
    if (!("ok" in state) || state.value.currentStage === null) {
      item.text = "$(list-tree) AIDLC Guide";
      item.tooltip = "AIDLC Guide: Open";
      return;
    }

    const stage = state.value.currentStage;
    // Timing is best-effort decoration: a failure here must not blank the
    // stage name the status bar exists to show.
    const timings = await session.service.reader.getTimings();
    const current = "ok" in timings ? timings.value.remaining.currentStage : null;

    if (current === null) {
      item.text = `$(list-tree) ${stage}`;
      item.tooltip = `AIDLC Guide — ${state.value.phase} / ${stage}`;
      return;
    }

    const elapsed = formatDuration(current.elapsedActiveMs);
    const remaining =
      current.remainingMs === null ? "—" : `≈${formatDuration(current.remainingMs)}`;
    item.text = `$(list-tree) ${stage} · ${elapsed} / ${remaining}`;
    item.tooltip = `AIDLC Guide — ${state.value.phase} / ${stage}\n経過（実作業推定）: ${elapsed}\n残り（実績からの推定）: ${remaining}`;
  } catch {
    item.text = "$(list-tree) AIDLC Guide";
  }
}
```

- [ ] **Step 2: 型検査**

Run: `bunx tsc --noEmit -p packages/vscode-extension`
Expected: PASS

- [ ] **Step 3: 拡張をビルドして手動確認**

Run: `bun run build:extension`
Expected: ビルド成功。VS Code で F5 の Extension Development Host を起動し、ステータスバーが `$(list-tree) <ステージ名> · <経過> / ≈<残り>` を表示することを目視で確認する。ホバーで3行のツールチップが出ること

- [ ] **Step 4: コミット**

```bash
git add packages/vscode-extension/src/status-bar.ts
git commit -m "feat(vscode-extension): ステータスバーに現在ステージの経過と残りを出す"
```

---

### Task 9: 性能計測の記録

`/api/timings` が NFR-2 の予算を侵していないことを、実 API 経路で確認して記録する。

**Files:**
- Create: `docs/perf/2026-07-27-timing-parse.md`

**Interfaces:**
- Consumes: `createGuideService` / `routeRead`（Task 5 の成果）
- Produces: なし（記録のみ）

- [ ] **Step 1: cold / warm を分けて計測**

Run:

```bash
bun -e 'const {createGuideService}=await import("./packages/api-core/src/service.ts");const {routeRead}=await import("./packages/api-core/src/handlers/read.ts");const s=createGuideService({workspaceRoot:process.cwd()});const u=new URL("http://x/api/timings");const hit=async()=>{const t=performance.now();await routeRead(s.readContext,u);return performance.now()-t};const cold=await hit();const w=[];for(let i=0;i<50;i++)w.push(await hit());w.sort((a,b)=>a-b);const q=(p)=>w[Math.min(w.length-1,Math.floor(w.length*p))].toFixed(1);console.log(JSON.stringify({cold:cold.toFixed(1),warm:{min:w[0].toFixed(1),p50:q(0.5),p95:q(0.95),max:w[w.length-1].toFixed(1)}},null,2))'
```

cold は新しいプロセスの初回1発（OS のページキャッシュが冷えている状態を狙うなら、直前に別作業を挟むか再起動後に取る）。warm は同一プロセスの50回。

- [ ] **Step 2: 記録を書く**

Create `docs/perf/2026-07-27-timing-parse.md` に、上のコマンドと実測値をそのまま貼る。平均は出さず min / p50 / p95 / max で記録し、cold と warm を分けること（project.md performance-validation 学習）。あわせて次を記す:

- 監査ログのイベント総数とシャードの行数（`GET /api/timings` が走査する量）
- NFR-2 の 3秒予算に対する位置づけ — `/api/timings` は**初回描画のクリティカルパス外**であり、この数値は予算消費ではなく回帰検知のための基準線であること

- [ ] **Step 3: フィクスチャが汚れていないことを確認**

Run: `git status --porcelain aidlc/`
Expected: 出力なし

- [ ] **Step 4: 品質ゲート全体を通す**

Run: `bun run check`
Expected: PASS（Biome / tsc ×3 / vitest + coverage / bun audit）

- [ ] **Step 5: コミット**

```bash
git add docs/perf/2026-07-27-timing-parse.md
git commit -m "docs: /api/timings の性能ベースラインを記録する"
```

---

## 実装後の確認

- [ ] `bun run check` が通る
- [ ] `git status --porcelain aidlc/` が空（実レコードへの書き込みゼロ、NFR-1）
- [ ] `bun run dashboard` でダッシュボードを開き、Now strip に経過と残りが出る
- [ ] VS Code の Extension Development Host でステータスバーに経過と残りが出る
