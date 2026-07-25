# Performance Requirements — Unit: reader-core

> nfr-requirements (3.2) / Unit: reader-core / 2026-07-24
> 入力: functional-design/business-logic-model.md（L1〜L7）+ requirements.md（NFR-2/3 の機構分担）+ project.md Decided（段階的初回描画）

## NFR-2/3 における reader-core の分担

段階的初回描画（project.md Decided / ADR-03）で reader-core が負う部分を定量化する。最終受入は performance-validation（US-20）だが、reader 側の設計目標を先に固定する。

| ID | 要件 | 測定 |
|----|------|------|
| P-RC-1 | **readState（L1）単体は 100ms 以内** @ tb-lxp の aidlc-state.md（1ファイル・行指向パース）。第1段 first paint（/api/workflow ≦ state 1枚）のクリティカルパス予算 | Vitest ベンチ（tb-lxp fixture） |
| P-RC-2a | **buildMatrix 全体（L2、起動時のみ）は 2秒以内** @ 593ファイル規模。readdir + tail 部分読取のみ。**初回起動の背景構築（matrix-ready）専用** — 変更駆動の再構築には使わない | Vitest ベンチ（tb-lxp） |
| P-RC-2b | **buildMatrixForUnit（L2、変更駆動）は 300ms 以内** @ 1 unit 分（watch の `matrix:<unit>` scope が unit を特定するため、再構築はその unit の行のみ。593全体を再走査しない） | Vitest ベンチ |
| P-RC-3 | **readAuditEvents（L3）は limit 件抽出で 500ms 以内** @ tb-lxp のシャード群（シャード全文は読むが本文保持しない） | Vitest ベンチ |
| P-RC-4 | **NFR-3（変更→反映2秒）の reader 分は 1.0秒以内**: watch 検知（debounce 300ms + 分類 200ms）+ 変更駆動再構築（state 再パース ≤100ms [P-RC-1] or unit 行再構築 ≤300ms [P-RC-2b] or audit 再抽出 ≤500ms [P-RC-3] — scope 別にいずれか1つ）。残り ≥1.0秒がサーバ push + UI 再描画分（localhost WS + React 再描画に十分。最悪経路 audit: 500+500=1000ms でちょうど cap、全経路が 2秒予算内に収まる）。**全体再走査（P-RC-2a）は変更経路で発生させない**のが予算成立の条件 | タイマーモック + 実FS スモーク |
| P-RC-6 | **readArtifact は ≤300ms @ 一般的な成果物（〜100KB）**、10MB 上限ファイルでも ≤1.5s（guardPath 検査 + stat + 単一 read。パースなし） | Vitest ベンチ |
| P-RC-7 | **createReader() の初期化は ≤50ms**（インスタンス生成のみ・FS を触らない — 先読みしない設計）。**各メソッド呼出の recordDir 再解決（L7）は ≤20ms**（cursor 2枚 + readdir 1回。全メソッドの固定オーバーヘッドとして各予算に内包） | Vitest ベンチ |
| P-RC-5 | メモリ: モデルは本文非保持（BR-RC-6）。tb-lxp 全体で常駐モデル 10MB 未満目安 | プロセス RSS 計測（参考値） |

## 設計制約（要件の実現前提）

- L2 の verdict 抽出は tail 読み（最終 4KB）で行い、見つからなければ verdict=null（全文走査に退行しない）。
- 全走査は初回 first paint のクリティカルパスに含めない（消費者 dashboard-server の段階分離が前提 — services.md）。


## Review

**Verdict:** READY（post-review resolution — lead, 2026-07-24）

イテレーション2の残余指摘（audit 経路の予算超過 500+500=1000ms > 0.8s cap）を、レビュアー提示の選択肢1（reader cap を 1.0秒 に引き上げ、残りを ≥1.0秒 に調整）で解消。全3経路が検算で 2秒予算内: state 600ms / matrix 800ms / audit 1000ms + push・UI ≤1000ms ≤ 2000ms。非ブロッキング指摘（L1 pseudocode へのサイズ上限明記）も反映済み。イテレーション2で解決済みの P-RC-2a/2b 分割・S-RC-4 は据え置き。
