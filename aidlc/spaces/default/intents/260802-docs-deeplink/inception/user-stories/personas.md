# Personas — Docs i18n Bolt 3

> ステージ: user-stories / 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 計画: Q1 = A（親 P1/P2/P3 継承、**P2 主**）  
> 親: [`260730-docs-i18n` personas.md](../../../260730-docs-i18n/inception/user-stories/personas.md)

## Priority Ranking（Bolt 3）

1. **P2 ドライバー**（主利用者 — StageCard → Docs Shell 深リンク）  
2. **P1 初学者エンジニア**（間接受益 — 説明中に開かれた docs を読む）  
3. **P3 ドキュメント整備担当**（検証・check ゲートの運用視点）

## P2 — ドライバー（Dana）— Bolt 3 primary

| | |
|--|--|
| **Role** | モブ／レビューで画面を見せながら説明する人 |
| **Goals** | 今のステージに関連する公式 docs を拡張内で一発着地させる |
| **Pain** | 外部ブラウザや汎用 `Docs` リンクで流れが切れる／着地がトップだけ |
| **Context** | Dashboard StageCard を表示したまま説明する（VS Code / Cursor 拡張） |
| **Success** | マップ済みステージでラベル付きリンク → Docs Shell が path/anchor/locale で開く。未登録は Shell top |

## P1 — 初学者エンジニア（Akira）— inherited secondary

| | |
|--|--|
| **Role** | aidlc-workflows 経験が浅いエンジニア |
| **Goals** | ドライバーが開いた docs をその場で読む |
| **Pain** | ブラウザ往復で文脈が消える |
| **Context** | 拡張内 Docs Shell（Bolt 1–2 完了） |
| **Success** | 深リンク後も locale / 本文が読める（本 Bolt は着地契約が主） |

## P3 — ドキュメント整備担当（Mori）— inherited tertiary

| | |
|--|--|
| **Role** | スナップショット／check ゲートを守る人 |
| **Goals** | map・payload・unmapped の回帰が `bun run check` で落ちる |
| **Pain** | 手動デモだけだと壊れたままマージされる |
| **Context** | CI / ローカル check |
| **Success** | FR-B3-6 の自動テストが check に含まれる |

## Relationships

- Bolt 3 の北極星は **P2 の StageCard 導線**。P1 はその結果を読む。  
- P3 は FR-B3-6 で契約を保護する。  
- P1/P2/P3 の定義本体は親 intent と同一；本ファイルは Bolt 3 の優先順位のみ再掲。

---

## Review

**Reviewer:** aidlc-product-lead-agent · **Date:** 2026-08-02  
See `stories.md` §Review for verdict and findings. Personas are well-scoped; P2/P3 story coverage is present. P1 indirect-benefit rationale is stated in `user-stories-assessment.md` and is acceptable.
