# User Flow — Docs i18n Bolt 4

> ステージ: rough-mockups (Ideation 1.6) / 作成日: 2026-08-03  
> 根拠: [rough-mockups-questions.md](./rough-mockups-questions.md) / [wireframes.md](./wireframes.md)  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [scope-document.md](../scope-definition/scope-document.md) / [intent-backlog.md](../scope-definition/intent-backlog.md)  
> Q1 = C / Q2 = C: Legacy Bridge → Open in Docs → Docs Shell。excerpt 記事マウントは禁止。

## Primary Flow A — Bridge degrade → Docs（US-06）

ドライバー／モブ参加者が Legacy Bridge から迷わず同梱 Docs（正本）へ移る。

```text
[Legacy Bridge panel (W1)]
        │
        │  excerpt NOT mounted as article
        │
        ▼
   Activate "Open in Docs" (W1a)  ← primary CTA
        │
        ▼
   Host openOfficialDoc({ locale, path?, anchor? })
   (Bolt 3 contract — reuse, do not fork)
        │
        ▼
   Docs Shell opens (W2)
   apply path + locale; anchor focus per Bolt 3
   NO external browser
```

**成功条件:** intent-statement DoD / scope M1–M3。Demo = Legacy Bridge → Open in Docs → Shell。

## Anti-flow（Fail）

```text
[Legacy Bridge]
   → user reads mounted excerpt as canonical article
   → Open in Docs missing or secondary only
   = FAIL (dual canonical / Q2=B forbidden)
```

## Flow vs Backlog

| Flow | proto-Units |
|------|-------------|
| A（happy） | U1 excerpt 非マウント → U2 Open in Docs CTA → U3 Demo |
| A（Should） | U4 US-09 補助が残っても A の成功を阻害しない |

## Non-goals in these flows

- StageCard deep-link 再実装（B3 / #29）
- locale / untranslated 再設計（Bolt 2 / #28）
- upstream 差分レポート（B5 / #31）
- ターミナル注入・会話スレッド投稿
- ブラウザ専用 Dashboard 経路（Q5 = A）
