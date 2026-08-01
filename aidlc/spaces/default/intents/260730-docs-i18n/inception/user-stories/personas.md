# Personas — Docs i18n

> ステージ: user-stories / 2026-07-31  
> 計画: Q1 = A（3ペルソナ）

## Priority Ranking

1. **P1 初学者エンジニア**（主受益者 — intent Q2 = A）  
2. **P2 ドライバー**（説明・モブ中の利用者）  
3. **P3 ドキュメント整備担当**（翻訳 PR・鮮度運用）

## P1 — 初学者エンジニア（Akira）

| | |
|--|--|
| **Role** | aidlc-workflows 経験が浅いエンジニア |
| **Goals** | 公式相当の説明を日本語で、拡張内だけで読む |
| **Pain** | 英語公式へ飛ばされる／ブラウザと IDE を往復する |
| **Context** | VS Code / Cursor 拡張を日常利用。オフラインでも読みたい |
| **Success** | en/ja を同じ TOC で切り替え、未訳でも迷わず読める（notice 付き） |

## P2 — ドライバー（Dana）

| | |
|--|--|
| **Role** | モブ／レビューで画面を見せながら説明する人 |
| **Goals** | 今のステージに関連する docs をその場で開く |
| **Pain** | 外部ブラウザや別サイトを探すと流れが切れる |
| **Context** | 拡張内 Dashboard を表示したまま説明したい |
| **Success** | StageCard から Docs Shell の該当箇所へ一発着地 |

## P3 — ドキュメント整備担当（Mori）

| | |
|--|--|
| **Role** | ja 翻訳と承認 PR を回す人 |
| **Goals** | upstream 差分を把握し、別 PR で安全に ja を更新する |
| **Pain** | 差分が分からず古いまま／機械翻訳の自動同梱は避けたい |
| **Context** | git / PR レビューが主戦場。Webview より運用フロー |
| **Success** | 初期 ja ブートストラップ後、継続更新は人手 PR のみ |

## Relationships

- P1 の体験が S-docs-1 の北極星。P2 は P1 向け導線を加速する。  
- P3 はコンテンツ鮮度を支え、P1/P2 の ja 品質を担保する。  

---

> **Review:** aidlc-product-lead-agent — READY (2026-07-31). Full review on `stories.md`.
