# Application Design — 質問ファイル

> ステージ: application-design (Inception) / 深度: Standard  
> Intent: `260801-docs-locale`（docs-i18n **Bolt 2**）  
> 上流: [requirements.md](../requirements-analysis/requirements.md) / [stories.md](../user-stories/stories.md) / codekb [architecture.md](../../../codekb/aidlc-guide/architecture.md) / [component-inventory.md](../../../codekb/aidlc-guide/component-inventory.md)  
> 親 AD: [`260730-docs-i18n` application-design](../../../260730-docs-i18n/inception/application-design/components.md) を継承。本 Bolt は **差分のみ**（keep-path / missing_ja / anchorApplied / coverage 床）。  
> AWS: 本プロジェクトはローカル専用 — クラウド質問は対象外。  
> 各質問の `[Answer]:` に選択肢の文字または自由記述を記入してください。  
> **Mode:** guided（推奨セット一括採用）

---

## Q1. コンポーネント境界（差分の置き場）

Bolt 2 の実装責任分割はどれですか？

- A. 親 AD どおり: `official-docs`（resolve / missing_ja / anchor）→ `api-core`（パススルー）→ `dashboard` Docs Shell（表示・フォーカス）→ `shared-types` は契約維持のみ。新パッケージなし
- B. missing_ja / keep-path の一部判定を `dashboard` 側にも持たせる（ワイヤと UI の二重判定）
- C. `api-core` で notice / anchor を再解釈して `OfficialDocsPage` を組み立て直す
- X. その他（具体的に記入）

[Answer]: A

## Q2. keep-path の所有

path 維持の一次ロジックはどこに置きますか？

- A. `official-docs` の resolve が常に要求 path を返し、UI は応答の `path` を表示するだけ（FR-B2-1 / FR-B2-4）
- B. UI が locale 切替時にローカル state の path を保持し、API 失敗時も path を書き換えない（サーバはベストエフォート）
- C. 両方で path を保証する（二重実装）
- X. その他（具体的に記入）

[Answer]: A

## Q3. notice / anchor の UI 契約

Docs Shell が wire をどう消費しますか？

- A. `notice === "missing_ja"` でのみバナー。`anchorApplied` で scrolled/top/none。404 推測や独自フラグ禁止（FR-B2-4.2、refined mockups どおり）
- B. HTTP ステータスや body 空でも未訳 UI を出してよい
- C. anchor スクロールはブラウザ hash のみに任せ、`anchorApplied` はログ用途
- X. その他（具体的に記入）

[Answer]: A

## Q4. サービス／通信

Bolt 2 のサービス境界はどれですか？

- A. 既存どおり単一モジュールモノリス: 拡張ホスト in-process `api-core` + Webview wire（HTTP 形 or postMessage）。新サービス／非同期バスなし
- B. official-docs を別プロセス／ワーカーに分離する
- C. dashboard-server 経路も Must 受入に含める
- X. その他（具体的に記入）

[Answer]: A

## Q5. coverage 床の置き場

NFR-B2-1（branch ≥ 95%）の計測対象とゲートは？

- A. `official-docs` の `resolve.ts` / `roots.ts` / `markdown.ts` を `bun run check` の coverage 設定に含め、床未達で check 失敗（requirements どおり）
- B. dashboard UI テストの coverage も同じ 95% 床に含める
- C. coverage は CI のみでローカル check からは外す
- X. その他（具体的に記入）

[Answer]: A

## Q6. ADR の粒度

Bolt 2 で正式 ADR にする決定はどれですか？（select all that apply）

- A. Wire-first: `OfficialDocsPage` を唯一の未訳／anchor 契約とし破壊的リネーム禁止
- B. Resolve-owns-path: keep-path / missing_ja / anchorApplied は `official-docs` が所有、UI は表示のみ
- C. Extension-surface-only: Bolt 2 Fail 条件は拡張 Docs Shell のみ（NFR-B2-3）
- D. A〜C すべて（推奨）
- E. 新規 ADR なし — 親 intent の ADR への差分注記のみ
- X. その他（具体的に記入）

[Answer]: D

---

## Consolidated Summary Confirmation

推奨セットを一括採用した結果の要約です。成果物生成前に確認してください。

1. **Q1 = A** — 親 AD 境界。新パッケージなし。official-docs → api-core → dashboard；shared-types は契約維持
2. **Q2 = A** — keep-path は official-docs resolve が所有。UI は応答 path を表示するだけ
3. **Q3 = A** — notice / anchorApplied のみで UI 制御。404 推測禁止
4. **Q4 = A** — 既存モジュールモノリス。新サービスなし。受入は拡張 Docs Shell
5. **Q5 = A** — coverage 床は official-docs 3 ファイルを `bun run check` に組込
6. **Q6 = D** — ADR 3 本（Wire-first / Resolve-owns-path / Extension-surface-only）

Does this all look correct before I generate the application-design artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
