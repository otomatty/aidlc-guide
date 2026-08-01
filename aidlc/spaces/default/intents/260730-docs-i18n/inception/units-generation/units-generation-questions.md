# Units Generation — 計画質問

> ステージ: units-generation (Inception 2.7) / Intent: `260730-docs-i18n`  
> 入力: application-design（components / methods / services / dependency / decisions）· requirements · stories  
> 推奨値で自動記入（ユーザー指示パターン 2026-07-31）  
> 注: 実装順序・critical path は **聞かない**（Delivery Planning 2.8）

---

## Q1. ユニット境界戦略

- A. コンポーネント／ドメイン境界（official-docs lib · api · UI · packaging）＋ proto-Unit（U1–U6）に揃える
- B. ユーザーストーリー 1:1（US-01–09 をそのまま Unit）
- C. デプロイ単位のみ（VSIX 1 Unit）
- X. その他

[Answer]: A

## Q2. 粒度

- A. 中粒 — おおよそ 6 Unit（Must 中心、Should は切れる Unit）
- B. 粗粒 — 3 Unit（content / reader-stack / navigation）
- C. 細粒 — パッケージ＋画面ごとに 8+ Unit
- X. その他

[Answer]: A

## Q3. 依存と並行

- A. 厳密トポロジ＋独立 Unit は並行可と明記（順序は 2.8）
- B. 直列のみ（並行機会を書かない）
- X. その他

[Answer]: A

## Q4. 統合契約

- A. `/api/official-docs/:locale/*` + `openOfficialDoc` payload + manifest/FS ツリー（ADR・stories どおり）
- B. 新規イベントバス契約を追加
- X. その他

[Answer]: A

## Q5. デプロイモデル

- A. ハイブリッド — library/ui はモノレポ共有、出荷は VSIX（extension embeds dashboard）。独立マイクロサービスなし
- B. 各 Unit を独立デプロイ
- X. その他

[Answer]: A
