# Risk & Sequencing Rationale — AIDLC Guide

> ステージ: delivery-planning (Inception 2.8) / 作成日: 2026-07-23
> 入力: bolt-plan.md + unit-of-work-dependency.md（DAG）+ requirements.md + stories.md

## 採用ヒューリスティック: walking-skeleton-first（Cockburn）+ 依存順

- **WSJF（Reinertsen/SAFe）は不使用**（Q1）: 全機能 Must・切り下げ非想定（scope-document）のため user-business value の差別化軸が無く、time criticality も無し（期限制約なし・品質優先 C-O3）。スコアリングは順序を変えない儀式になるため省略。
- **順序の実質的な決定因子は2つ**: (a) DAG の依存（reader-core が最大共通依存 — intent-backlog の配送性検証どおり）、(b) リスク（統合点の早期実証 = 骨格、Milkdown = M3 冒頭検証）。

## Bolt 順序と DAG の整合

B1(骨格スライス)→B2(U1)→B3(U2+U4)→B4(U5+U6)→B5(U3)→B6(U7)→B7(U8+U9) は 2.7 DAG のトポロジカル順序の一つ。**トポロジカル順序からの逸脱は無い**（正当化不要のケース）。エッジ注記の2点も尊重: docs-bridge の型契約依存は B1 で shared-types が骨組み込みで凍結されるため B3 で満たされる; dashboard-ui→dashboard-server の build-time エッジは B1 でビルド順スクリプトごと確立する。

## リスクと配置

| リスク（feasibility/requirements 由来） | 対応する配置 |
|--------------------------------------|-------------|
| 構造規約（一方向依存/ファサード/Result）が実データで成立しない | **B1 骨格**で最初に実証（最大の統合リスクを最小コストで前倒し） |
| State Version 8 パース・593ファイル規模・部分破損（NFR-6） | B2 で golden + 5失敗モード fixture。以降の全 Bolt の土台を固める |
| Milkdown が実成果物で崩れる（feasibility R-2・中リスク） | **B6 冒頭**の実データ検証 + 交代先確定（BlockNote/plain preview）。M3 まで遅らせるのは PRD §11 の決定順序どおりで、先行 Bolt は Milkdown に非依存（ADR-05 隔離）のため手戻りが波及しない |
| fork の JSONL フラッシュ制約（C-T5・解決不能） | B5 は「制約明記 + /branch 案内」で受容（設計済み）。順序に影響なし |
| LAN 公開の情報開示（NFR-7） | B7 で loopback 既定 + 警告を最後に実装するが、既定 loopback 自体は B1 のサーバ骨組みから有効（安全側デフォルト先行） |

## ゲート運用

B1 は必須ゲート（walking skeleton）。B2 以降はラダープロンプトの選択（autonomous / gated）に従う。失敗は常に halt-and-ask。ゲート数を抑えるための Bolt 束ね（Q2: 7 Bolt）は、束ねた Unit が同一マイルストーン・同一確信仮説に属す場合のみ行った（B3=M1完成、B4=M2核、B7=M4完成）。
