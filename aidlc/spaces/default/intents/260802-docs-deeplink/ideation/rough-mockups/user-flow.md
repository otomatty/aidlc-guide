# User Flow — Docs i18n Bolt 3

> ステージ: rough-mockups (Ideation 1.6) / 作成日: 2026-08-02  
> 根拠: [rough-mockups-questions.md](./rough-mockups-questions.md) / [wireframes.md](./wireframes.md)  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [scope-document.md](../scope-definition/scope-document.md) / [intent-backlog.md](../scope-definition/intent-backlog.md)  
> Q1 = C / Q2 = C: StageCard → Shell 連続。マップ／未マップの両分岐。

## Primary Flow A — StageCard deep link（US-05）

ドライバーが現在ステージの StageCard から公式 docs を拡張内で開く。

```text
[Dashboard StageCard]
        │
        ▼
   Activate OpenOfficialDocLink (W1a)
   label = "Docs: <Stage name>"  (not bare "Docs")
        │
        ▼
   Host openOfficialDoc({ locale, path?, anchor? })
   locale = preference || en
        │
        ├─► slug mapped? ──► Shell opens (W2)
        │                    apply path + locale
        │                    anchor? → scroll/focus (W2a)
        │                    NO external browser
        │
        └─► slug unmapped? ─► Shell opens at top (W2a)
                             no path selected
```

**成功条件:** Issue #29 DoD / scope M1–M6。Demo = intent-capture StageCard → Docs Shell 着地。

## Flow vs Backlog

| Flow | proto-Units |
|------|-------------|
| A（mapped） | U1 契約 → U2 host → U3 StageCard → U4 Shell locale |
| A（unmapped） | U1 + U2 + U3（path なし）→ U4 top |

## Non-goals in these flows

- BridgeRedirectPanel / excerpt 非マウント（B4 / #30）
- locale keep-path / missing_ja の再設計（Bolt 2）
- ブラウザ専用 Dashboard 経路（Q5 = A）
- 7 slug 以外への map 拡張
