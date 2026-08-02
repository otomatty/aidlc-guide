# NFR Requirements — Unit: official-docs

> ステージ: nfr-requirements / unit: **official-docs** (library)  
> 産出: security-requirements + tech-stack-decisions  
> **Mode:** guided（推奨 · Looks correct）

---

## Q1. セキュリティ境界

- A. Path containment via `guardPath` のみ。認証なし（ローカル IDE）。workspace 外読取拒否が Must
- B. 追加の署名検証・暗号化を Bolt 2 で必須にする
- X. その他

[Answer]: A

## Q2. カバレッジ NFR

- A. NFR-B2-1 どおり branch ≥95% on resolve/roots/markdown in `bun run check`
- B. 行 coverage のみでよい
- X. その他

[Answer]: A

## Q3. テックスタック

- A. 既存維持: TypeScript + bun/Vitest + workspace package。新ランタイム／クラウド依存なし
- B. 新依存を追加してよい
- X. その他

[Answer]: A

## Q4. コンプライアンス

- A. ローカル専用・個人データなし。クラウド/規制フレームワーク質問は N/A
- B. 追加の規制マッピングが必要
- X. その他

[Answer]: A

---

## Consolidated Summary Confirmation

1. Q1=A guardPath only  
2. Q2=A branch 95% on three files  
3. Q3=A existing stack  
4. Q4=A compliance N/A  

[Answer]: Looks correct
