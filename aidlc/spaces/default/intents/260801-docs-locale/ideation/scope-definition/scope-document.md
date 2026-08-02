# Scope Document — Docs i18n Bolt 2

> ステージ: scope-definition (Ideation 1.4) / 作成日: 2026-08-01  
> Intent: `260801-docs-locale`  
> 根拠: [scope-definition-questions.md](./scope-definition-questions.md)  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [feasibility-assessment.md](../feasibility/feasibility-assessment.md) / [constraint-register.md](../feasibility/constraint-register.md)

## In Scope（Bolt 2 に含む）

### Minimum Viable Outcome（「できた」の定義）

**S-docs-1（部分 `ja` 対応）:** 拡張内で **en / ja を同じ目次・同じスタイルで切り替え**られ、`ja` 欠落時も locale を `ja` のまま維持し、未訳であることを notice で明示する。欠落アンカーはページ先頭へフォールバックする（Q1 = D）。

### Must（Bolt 2 必須）

| ID | 能力 | 出典 |
|----|------|------|
| M1 | **keep-path 切替** — 同一 path で en↔ja を切替可能 | Q2 = A / intent Q3 = A |
| M2 | **missing ja notice** — `ja` 欠落時に `role=status` notice を表示し、locale は `ja` のまま | Q2 = A / intent Q3 = B |
| M3 | **missing anchor フォールバック** — 欠落アンカーはページ先頭へ | Q2 = A / intent Q3 = C |
| M4 | **coverage 床** — official-docs の branch coverage 95% が `bun run check` で効く | Q2 = A / intent Q3 = D / team.md Q2 = A |

### Should（Bolt 2 で望ましいが切り下げ可）

| ID | 能力 | 出典 |
|----|------|------|
| S1 | Codex 指摘の Docs Shell `h1` 階層修正 | intent Q3 = E（必須外） |

### Could（余裕があれば）

| ID | 能力 |
|----|------|
| C1 | 未訳 notice の文言・デザインのブラッシュアップ |

## Out of Scope（Bolt 2 外）

| ID | 内容 | 出典 |
|----|------|------|
| O1 | StageCard → `openOfficialDoc` ディープリンク | Q5 = A / intent Q5 = E（→ B3 / #29） |
| O2 | BridgeRedirectPanel | Q5 = B / intent Q5 = E（→ B4 / #30） |
| O3 | upstream 差分レポート本番化 | Q5 = C / intent Q5 = E（→ B5 / #31） |
| O4 | 新しい公式ツリーの大幅追加（harness-engineering 等） | Q5 = D / intent Q5 = E |
| O5 | 機械翻訳の自動同梱・自動公開（継続パイプライン） | 親 intent Q3 = B |
| O6 | 社内向け別ドキュメントサイト／CMS | 親 intent Q3 = C |
| O7 | クラウド／AWS 上の docs ホスティング | 親 intent Q3 = E / C-T1 |
| O8 | aidlc-workflows エンジン／ステージ定義の変更 | project Forbidden |

## Boundaries（境界）

- **コンテンツ:** en は upstream スナップショット。ja は人間承認後にのみ継続更新（親 intent 継承）
- **実行時:** ネットワーク fetch なし。更新はリポジトリ／拡張リリース単位（constraint C-T1）
- **統合面:** `vscode-extension` + `dashboard` Docs Shell が第一（feasibility Q1 = E）
- **locale コード:** `en` / `ja` のみ（C-T7）
- **未訳時:** locale は `ja` のまま維持し、notice（`role=status`）で明示（C-T8）
- **アンカー:** 欠落時はページ先頭へフォールバック（C-T9）

## Sequencing（並べ方）

**依存優先**（Q4 = A）:

1. **official-docs** — missing_ja / anchor 分岐の残り実装
2. **api-core** — `/api/official-docs` 応答の locale/notice 拡張
3. **dashboard** — Docs Shell の locale 切替・未訳 notice UI
4. **coverage 床** — `bun run check` に branch 95% を組み込み

## Deadlines

ハードデッドラインなし（Q6 = A）。品質と運用可能性を優先。

## Traceability

| 上流 | 本スコープでの扱い |
|------|-------------------|
| intent S-docs-1（部分 `ja`） | MVP Done = Q1 = D |
| intent keep-path / notice / anchor / coverage | M1, M2, M3, M4 |
| intent B3-B5 除外 | O1, O2, O3 |
| feasibility C-T1〜C-T9 | Boundaries に継承 |
| 親 intent M1, M2（同梱・切替） | Bolt 1 で完了済み、本 intent は延長 |
