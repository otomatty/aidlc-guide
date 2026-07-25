# Logical Components — Unit: btw

> nfr-design (3.3) / Unit: btw / 2026-07-23
> 入力: functional-design/domain-entities.md + business-logic-model.md + 本ステージの 4 設計文書

## モジュール構成（packages/btw/src/）

| モジュール | 責務 | 依存 |
|-----------|------|------|
| `cli.ts`（bin） | main(): **前提チェック（`Bun.which("claude")` を1回だけ・P-BTW-1 のホットパス）**→ 引数→BtwCommand→実行、BtwError 正規化 + exit（reliability-design R-BTW-1） | 全下位 |
| `parse.ts` | argv → BtwCommand（相互排他検証） | — |
| `slug.ts` | `projectSlug(cwd)`（`\` `/` `:` `.` → `-`、純関数） | node:path |
| `resolve.ts` | slug ディレクトリ → SessionRef（readdir+stat 単走査、内容非読取） | slug.ts |
| `plan.ts` | (BtwCommand, platform) → SpawnPlan — **全実行モード（side/fork=launch"terminal"、headless=launch"inline"）の起動計画を生成する唯一の場所**。OS 分岐は terminal 系のみ、`basePlanArgs`（--permission-mode plan）は**全モードで必須連結**（S-BTW-1 の単一 enforcement point。テストは3モード全部で包含検証） | — |
| `spawn.ts` | SpawnPlan → Bun.spawn 配列実行（launch="terminal": detached / "inline": stdio inherit 同期） | plan.ts |
| `help.ts` | 静的 help テキスト（fork 制約 + /branch 案内を含む定数） | — |

## データフロー

```
argv → parse → BtwCommand ─ side/fork → [resolve] → plan(terminal) → spawn
                          ├ headless ──────────────→ plan(inline)  → spawn
                          └ help → print
```

**全実行モードが plan → spawn を通る**（plan フラグ連結の経路が1本 — domain-entities.md の SpawnPlan.launch 定義と一致）。テキストのみ・単方向・状態なし。全純関数（spawn.ts 以外）が Vitest 対象、spawn はスモーク。

## Review

**Verdict: READY**

Re-verification of iteration-1 findings (headless bypassed plan.ts; prerequisite-check module unassigned; BtwError missing from entity list):

- **plan.ts bypass (blocking) — resolved.** Line 14 now defines plan.ts as the sole generator for all three execution modes (side/fork → `launch:"terminal"`, headless → `launch:"inline"`), with `basePlanArgs` (`--permission-mode plan`) required-concatenated in all modes. The dataflow diagram (lines 20-24) shows headless routed through `plan(inline) → spawn` instead of calling spawn directly. `domain-entities.md:26-31,46` defines `SpawnPlan.launch: "terminal" | "inline"` and states all modes generate via plan.ts → spawn — the "唯一の場所" / single-enforcement-point claim is now consistent and true across all modes, matching security-design.md's S-BTW-1 row (`basePlanArgs` as single constant, all SpawnPlan-generating functions must concatenate it, tested across all modes).
- **Prerequisite-check module (minor) — resolved.** Line 10 explicitly assigns `Bun.which("claude")` to `cli.ts`'s `main()`, ahead of arg parsing.
- **BtwError entity (minor) — resolved.** `domain-entities.md:6` now reads "4型で足りる" (corrected from 3型); `BtwError` is fully defined at lines 34-39 (code/message/hint) and tied to reliability-design R-BTW-1/5.
- **Regression check** — `spawn.ts` signature remains `SpawnPlan → Bun.spawn` (SpawnPlan-only, no widening); no new contradictions found between logical-components.md, domain-entities.md, and security-design.md.

No blocking or minor issues remain.

