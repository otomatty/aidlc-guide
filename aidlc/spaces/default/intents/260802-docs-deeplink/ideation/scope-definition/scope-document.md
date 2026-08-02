# Scope Document — Docs i18n Bolt 3

> ステージ: scope-definition (Ideation 1.4) / 作成日: 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 根拠: [scope-definition-questions.md](./scope-definition-questions.md)  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [feasibility-assessment.md](../feasibility/feasibility-assessment.md) / [constraint-register.md](../feasibility/constraint-register.md)

## In Scope（Bolt 3 に含む）

### Minimum Viable Outcome（「できた」の定義）

**US-05:** ドライバーが StageCard から拡張内 Docs Shell に着地できる。7 slug map・ラベル ≠ bare `Docs`・payload `{locale,path,anchor?}`・外部ブラウザなし・unmapped→top・Demo（intent-capture StageCard → Shell）を満たす（Q1 = D）。

### Must（Bolt 3 必須）

| ID | 能力 | 出典 |
|----|------|------|
| M1 | **7 slug map** — StageCard 経由で静的 map が解決される | Q2 = A / Issue #29 |
| M2 | **ラベル** — bare `Docs` alone ではない | Q2 = A |
| M3 | **payload** — `{locale, path, anchor?}` を openOfficialDoc 相当で発行 | Q2 = A |
| M4 | **内部着地** — マップ済みは外部ブラウザを開かない | Q2 = A |
| M5 | **unmapped → top** — Docs Shell 先頭へ着地 | Q2 = A |
| M6 | **Demo** — intent-capture StageCard → Docs Shell 着地 | Q2 = A / Q1 = D |

### Should / Could

| ID | 能力 | 仕分け |
|----|------|--------|
| — | （本 Bolt では Should/Could を置かない。DoD はすべて Must） | Q2 = A |

## Out of Scope（Bolt 3 外）

| ID | 内容 | 出典 |
|----|------|------|
| O1 | BridgeRedirectPanel / excerpt 非マウント | Q5 = F（→ B4 / #30） |
| O2 | upstream 差分レポート本番化 | Q5 = F（→ B5 / #31） |
| O3 | locale keep-path / missing_ja の再実装 | Q5 = F（Bolt 2 完了） |
| O4 | 新しい公式ツリーの大幅追加 | Q5 = F |
| O5 | 7 slug 以外への map 拡張 | Q5 = F |
| O6 | クラウド／AWS 上の docs ホスティング | feasibility C-T1 |
| O7 | aidlc-workflows エンジン／ステージ定義の変更 | project Forbidden |

## Boundaries（境界）

- **実行時:** ネットワーク fetch なし。深リンクは拡張ホスト内で完結（constraint C-T1）
- **統合面:** StageCard + vscode-extension host + Docs Shell（feasibility Q1 = E）
- **slug map:** 既存 7 slug を正とし本 Bolt で増やさない（C-T3）
- **locale:** `en` / `ja`、last-used preference \|\| `en`（C-T6）
- **ラベル:** bare `Docs` alone 禁止（C-T8）

## Sequencing（並べ方）

**契約優先**（Q4 = A）:

1. **契約** — payload / メッセージ type 文字列を FD でピン留め
2. **vscode-extension** — openOfficialDoc ホストハンドラ
3. **dashboard StageCard** — DocsLink → openOfficialDoc 配線・ラベル
4. **Docs Shell** — locale 付き deep-link 適用（既存 path/anchor 延長）

## Deadlines

ハードデッドラインなし（Q6 = A）。品質と運用可能性を優先。

## Traceability

| 上流 | 本スコープでの扱い |
|------|-------------------|
| intent US-05 / Issue #29 DoD | M1–M6 / MVP = Q1 = D |
| intent B4/B5・Bolt 2 再実装除外 | O1–O3 |
| feasibility C-T1〜C-T8 | Boundaries に継承 |
| feasibility Go | In Scope 実行の前提 |
