# Personas — Docs i18n Bolt 2

> ステージ: user-stories (Inception 2.4) / 作成日: 2026-08-01  
> Intent: `260801-docs-locale`  
> 計画: Q1 = C（親 intent の P1/P2/P3 を継承、P1 を主とする）

## Priority Ranking

1. **P1 初学者エンジニア**（主受益者 — intent Q2 = A）  
2. **P2 ドライバー**（説明・モブ中の利用者）  
3. **P3 ドキュメント整備担当**（翻訳 PR・鮮度運用）

## P1 — 初学者エンジニア（Akira）

| | |
|--|--|
| **Role** | aidlc-workflows 経験が浅いエンジニア |
| **Goals** | 公式相当の説明を日本語で、拡張内だけで読む。部分 `ja` でも迷わない |
| **Pain** | 英語公式へ飛ばされる／ブラウザと IDE を往復する。未訳ページで locale が戻ると混乱する |
| **Context** | VS Code / Cursor 拡張を日常利用。オフラインでも読みたい |
| **Success** | en/ja を同じ TOC で切り替え、未訳でも notice 付きで迷わず読める（Bolt 2 の焦点） |

## P2 — ドライバー（Dana）

| | |
|--|--|
| **Role** | モブ／レビューで画面を見せながら説明する人 |
| **Goals** | 今のステージに関連する docs をその場で開く（Bolt 3 で本格化） |
| **Pain** | 外部ブラウザや別サイトを探すと流れが切れる |
| **Context** | 拡張内 Dashboard を表示したまま説明したい |
| **Success** | StageCard から Docs Shell の該当箇所へ一発着地（Bolt 3 スコープ） |

## P3 — ドキュメント整備担当（Mori）

| | |
|--|--|
| **Role** | ja 翻訳と承認 PR を回す人 |
| **Goals** | upstream 差分を把握し、別 PR で安全に ja を更新する（Bolt 5 で本格化） |
| **Pain** | 差分が分からず古いまま／機械翻訳の自動同梱は避けたい |
| **Context** | git / PR レビューが主戦場。Webview より運用フロー |
| **Success** | 初期 ja ブートストラップ後、継続更新は人手 PR のみ（親 intent で確立済み） |

## Relationships

- P1 の体験が S-docs-1 の北極星。Bolt 2 は P1 の「部分 `ja` でも迷わない」を実現する。  
- P2 は Bolt 3（深リンク）、P3 は Bolt 5（差分レポート）で本格化する。  
- Bolt 2 では P1 に集中し、P2/P3 は親 intent のまま。

---

> **Review:** aidlc-product-lead-agent — READY with stories.md (2026-08-01)
