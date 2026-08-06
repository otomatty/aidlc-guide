# Practices Discovery — 質問ファイル

> ステージ: practices-discovery (Inception) / 深度: Standard  
> Intent: `260802-docs-bridge`（Bolt 4 / #30）  
> 再実行: `aidlc/spaces/default/memory/team.md` を既定として提示  
> CodeKB Modify: HEAD `ee2fc24`（official-docs / openOfficialDoc / Bridge excerpt debt）  
> **Mode:** Guide Me（推奨適用）

---

## Q1. Way of Working / Walking Skeleton / Deployment / Code Style

既存 `team.md`（trunk-based、skeleton 継承、ローカル専用、Biome、en/ja ツリー、`/api/official-docs`）を **Bolt 4 でもそのまま継承**しますか？

- A. はい — 変更なしで継承（推奨）
- B. いいえ — 変更点を記入
- X. その他

[Answer]: A

## Q2. Testing Posture（Bolt 4 追加）

US-06（excerpt 非マウント + Open in Docs primary）のテスト方針はどれですか？

- A. UI/契約テストを `bun run check` に含める（StageCard/Bridge で excerpt 非表示 + CTA→`open-official-doc`）。official-docs の 95% 床は継承
- B. 手動 Demo のみ（自動テスト追加なし）
- C. A + 新しい coverage 床を別パッケージに新設
- X. その他

[Answer]: A

## Q3. VSIX / セキュリティ衛生

VSIX に秘密・`.env`・`aidlc/` ランタイムを出荷しない Mandated を継続しますか？

- A. はい（継続）
- B. いいえ（変更を記入）
- X. その他

[Answer]: A

## Q4. ハード制約の追加

Bolt 4 で **新しい** Mandated / Forbidden を `project.md` に追加しますか？

- A. なし — 既存の Forbidden（workflows 非変更・クラウド不使用等）で十分
- B. あり（文言を記入）
- X. その他

[Answer]: A

## Q5. Affirm 意図

このインタビュー結果を affirmation 時に `team.md` / `project.md` へ promote してよいですか？（最終 Approve で実行）

- A. はい（Q1–Q4 の結果を promote）
- B. いいえ（ドラフトのみ・promote 保留）
- X. その他

[Answer]: A

---

## Consolidated Summary

| Q | Answer | Decision |
|---|--------|----------|
| Q1 | A | team.md 継承 |
| Q2 | A | US-06 UI/契約テストを check に含める |
| Q3 | A | VSIX 衛生継続 |
| Q4 | A | 新規 hard constraint なし |
| Q5 | A | Approve 時に promote |

Looks correct / Request changes?

- Looks correct
- Request changes

[Answer]: Looks correct
