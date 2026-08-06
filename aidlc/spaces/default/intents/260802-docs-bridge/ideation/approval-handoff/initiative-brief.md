# Initiative Brief — Docs i18n Bolt 4

> ステージ: approval-handoff (Ideation 1.7) / 作成日: 2026-08-03  
> Intent: `260802-docs-bridge`  
> 追跡 Issue: [#30](https://github.com/otomatty/aidlc-guide/issues/30)  
> 上流: intent-statement / feasibility-assessment / constraint-register / scope-document / intent-backlog / team-assessment / wireframes

## Intent & Problem Statement

Bolt 3 まで StageCard → `openOfficialDoc` → Docs Shell は成立したが、**Legacy Bridge がまだ正本扱いになり得る**（excerpt 記事マウント／Open in Docs が一次導線でない）。US-06 として Bridge を導線に縮退し、正本は同梱 Docs のみにする。

## Market Validation Summary

該当なし — market-research は本 intent で SKIP（親 intent / Bolt 系列で十分）。brownfield の UI 契約変更。

## Feasibility & Risk Highlights

- **Verdict:** Go — 技術・組織・規制のブロッカーなし（feasibility-assessment）
- **主要リスク:** R1（excerpt 二重正本）、R2（CTA が primary にならない）、R3（`openOfficialDoc` 再利用漏れ）、R4（US-09 Must 化）
- **緩和:** excerpt 非マウントの受入、primary CTA 固定、Bolt 3 契約の明示引用、US-09 は Should（constraint-register C-O2）

## Scope Boundary

- **In:** M1–M3（excerpt 非マウント / Open in Docs primary / Demo）+ S1 US-09 Should
- **Out:** B3 再実装（#29）、B5 差分（#31）、locale 再実装、ターミナル注入・会話投稿、クラウド、workflows 変更

## Concept Visuals

- W1: Legacy Bridge degrade（excerpt 非マウント）
- W1a: Open in Docs primary CTA → `openOfficialDoc`
- W2: Docs Shell 着地（Bolt 3 再利用）

## Team Plan

ソロ＋PR（team-assessment）。常設モブなし。キャパは本 Bolt に集中可能。スキルギャップなし。

## Go/No-Go Recommendation

**Go** — Inception へ進む（Q7 = A）。

## Review

**Reviewer:** aidlc-delivery-agent (+ product context)  
**Verdict:** READY  
**Date:** 2026-08-03

### What holds

- Brief traces intent-statement / scope-document / feasibility-assessment / constraint-register / team-assessment / wireframes.
- In/Out and risks R1–R4 match RAID + constraints; Go aligns with approval Q7=A.
