# Mob Composition — Docs i18n Bolt 4

> ステージ: team-formation / Intent: `260802-docs-bridge` / 2026-08-03  
> 上流: [scope-document.md](../scope-definition/scope-document.md) / [intent-backlog.md](../scope-definition/intent-backlog.md) / [feasibility-assessment.md](../feasibility/feasibility-assessment.md)  
> トポロジ: ソロ＋PR（Q4=A）。常設モブは組まない。

## Preferred Topology

**Stream-aligned solo** with spot review — team.md の trunk-based / 短命ブランチを継承。intent-backlog の U1→U2→U3 を一人で直列に進める。

## Session Plan（任意モブ）

常設モブは不要。必要なら次の局面だけスポットでペア／モブ可:

| 局面 | 推奨 | 役割 |
|------|------|------|
| U1 excerpt 非マウントの UI 契約確認 | 任意ペア | Driver=実行者 / Navigator=レビュア |
| U2 CTA → `openOfficialDoc` 配線 | 任意ペア | 同上 |
| U3 Demo 録画・受入 | ソロ可 | 実行者 |

## Onboarding Checklist（本 Bolt）

- [ ] scope-document / intent-backlog / feasibility-assessment を読む
- [ ] Bolt 3 の `openOfficialDoc` / Docs Shell 着地を手元で一度再現する
- [ ] Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30) を追跡票にする
- [ ] feature ブランチを `main` から切る（team.md Way of Working）

## Review

**Reviewer:** aidlc-delivery-agent  
**Verdict:** READY  
**Date:** 2026-08-03

### What holds

- Solo＋PR は scope-document の薄い Must 集合（M1–M3）と整合
- skill-matrix に重大ギャップなし（Q3=A）— feasibility-assessment Go と一致
- 外部／クラウド人材不要（Q6=A）
- Upstream 参照: scope-document, intent-backlog, feasibility-assessment
