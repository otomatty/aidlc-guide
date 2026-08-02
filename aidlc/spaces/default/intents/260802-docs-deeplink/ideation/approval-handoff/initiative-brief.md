# Initiative Brief — Docs i18n Bolt 3

> ステージ: approval-handoff (Ideation 1.7) / 作成日: 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 追跡 Issue: [#29](https://github.com/otomatty/aidlc-guide/issues/29)  
> 上流: intent-statement / feasibility-assessment / constraint-register / scope-document / intent-backlog / wireframes

## Intent & Problem Statement

Bolt 2（PR #34）まで Docs Shell・locale/untranslated は完成したが、**StageCard の docs リンクがまだ拡張外**（外部ブラウザ／IDE open）。US-05 として 7 slug map・ラベル・`{locale,path,anchor?}`・内部着地・unmapped→top を実装する。

## Market Validation Summary

該当なし — market-research は SKIP（親 intent `260730-docs-i18n` で実施済み）。本 intent は brownfield 配線。

## Feasibility & Risk Highlights

- **Verdict:** Go — 技術・組織・規制のブロッカーなし
- **主要リスク:** R1（レガシー docs 経路の残存）、R2（locale が Shell に載らない）、R3（unmapped→top 競合）、R4（host 契約名ずれ）、R5（B4 scope creep）
- **緩和:** openOfficialDoc 一本化、deep-link に locale、FD で type 文字列ピン留め、intent Q5=E で B4/B5 除外

## Scope Boundary

- **In:** M1–M6（7 slug・ラベル・payload・内部着地・unmapped→top・Demo）
- **Out:** B4 Bridge（#30）、B5 差分（#31）、Bolt 2 再実装、map 拡張、クラウド

## Concept Visuals

- W1a: OpenOfficialDocLink（`Docs: <Stage>`、bare `Docs` 禁止）
- W2a: deep-link land（mapped path/anchor/locale、unmapped→top）

## Team Plan

単独作業想定（team-formation SKIP）。レビューは各ステージゲートで実施。

## Go/No-Go Recommendation

**Go** — Inception へ進む（Q7 = A）。
