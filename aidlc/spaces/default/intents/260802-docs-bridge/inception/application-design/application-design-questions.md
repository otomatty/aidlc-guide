# Application Design — 質問ファイル

> ステージ: application-design (Inception) / 深度: Standard  
> Intent: `260802-docs-bridge`（docs-i18n **Bolt 4** / Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30)）  
> 上流: requirements / stories / codekb architecture · component-inventory / team-practices  
> 新規サービスは作らず、既存 dashboard + vscode-extension の差分設計を固定します。  
> **Mode:** Guide Me（推奨適用）

---

## Q1. コンポーネント境界（差分の置き場）

Bolt 4 の実装差分はどこに置きますか？

- A. `dashboard`（StageCard / Bridge UI: excerpt 非マウント + Open in Docs CTA）が主。host は既存 `open-official-doc` を再利用（新規パッケージなし）
- B. 新規 `docs-navigation` パッケージを切る
- C. `docs-bridge` に UI を寄せる
- X. その他（具体的に記入）

[Answer]: A

## Q2. open-official-doc 経路

CTA からホストへの経路はどれですか？

- A. 既存 `OpenOfficialDocLink` / 同等ヘルパ → postMessage `open-official-doc` → `vscode-extension` ハンドラ（Bolt 3 契約そのまま）
- B. 新しい message type を追加する
- C. HTTP API 経由で着地する
- X. その他（具体的に記入）

[Answer]: A

## Q3. excerpt データの扱い

API が excerpt を返しても UI はどうしますか？

- A. UI 契約で非マウントのみ（`docs-bridge` / `/api/stage` の excerpt 削除は必須にしない）
- B. API から excerpt フィールドを削除するまで Must
- X. その他（具体的に記入）

[Answer]: A

## Q4. AWS / クラウド

- A. 非該当（ローカル専用。AWS 設計成果物は N/A と明記）
- B. クラウド構成を追加する
- X. その他（具体的に記入）

[Answer]: A

## Q5. ADR の粒度

- A. ADR なし（差分が小さく decisions.md の箇条書きで十分）
- B. open-official-doc 再利用について 1 ADR
- C. Bridge degrade 全体で 1 ADR
- D. B + C（再利用 + degrade）を decisions.md に短く記録（正式 ADR ファイルは任意）
- X. その他（具体的に記入）

[Answer]: D

---

## Consolidated Summary

| Q | Answer | Decision |
|---|--------|----------|
| Q1 | A | dashboard UI 差分 + host 再利用 |
| Q2 | A | 既存 open-official-doc 経路 |
| Q3 | A | UI 非マウントのみ |
| Q4 | A | AWS N/A |
| Q5 | D | decisions.md に再利用＋degrade を記録 |

Looks correct / Request changes?

- Looks correct
- Request changes

[Answer]: Looks correct
