# Security Requirements — Unit: official-docs (Bolt 2)

> nfr-requirements / official-docs (library) / 2026-08-02  
> 上流: [business-logic-model.md](../functional-design/business-logic-model.md) · [business-rules.md](../functional-design/business-rules.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [technology-stack.md](../../../../../codekb/aidlc-guide/technology-stack.md)

## Requirements

| ID | 要件 | 出所 | 検証 |
|----|------|------|------|
| S-B2-OD-1 | すべてのコンテンツ読取は `guardPath` + locale content root | NFR-B2-2 · BR-B2-OD-6 · Q1=A | 否定テスト in `bun run check` |
| S-B2-OD-2 | ルート外パスは `path_rejected`（生 FS しない） | BR-B2-OD-6 | ベクトル表 |
| S-B2-OD-3 | ライブラリ内でネットワーク I/O 禁止 | NFR-B2-2 · BR-B2-OD-7 | 静的検査 / 依存レビュー |
| S-B2-OD-4 | `missing_ja` を HTTP/例外ヒューリスティックで再発明しない（契約は DTO `notice`） | ADR-B2-001 · FR-B2-4 | 単体テスト |
| S-B2-OD-5 | branch coverage ≥ 95% on `resolve.ts` / `roots.ts` / `markdown.ts` | NFR-B2-1 · Q2=A | Vitest coverage in `bun run check` |
| S-B2-OD-6 | 認証・クラウド IdP・暗号化 at-rest は本 unit 非適用（ローカル IDE） | Q1=A · Q4=A | N/A |

## Threat notes (lightweight)

| Concern | Stance |
|---------|--------|
| Path traversal | Mitigated by guardPath |
| Data exfil via network | No network I/O |
| PII | Official docs content only; no user PII store |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent
**Verdict:** READY
**Date:** 2026-08-02

### Checks

- **Library scope correct:** only `security-requirements.md` + `tech-stack-decisions.md` produced; no perf/scalability/reliability files (produces_kinds excludes untagged library units). ✓
- **Q1–Q4=A encoded:** Q1=A → S-B2-OD-1/S-B2-OD-6 (guardPath only, no auth); Q2=A → S-B2-OD-5 (branch ≥95%); Q4=A → S-B2-OD-6 (compliance N/A). ✓
- **required-sections sensor:** `## Requirements` + `## Threat notes` = 2 H2s. ✓
- **upstream-coverage sensor:** header cites all 4 consumes (business-logic-model.md, business-rules.md, requirements.md, technology-stack.md). ✓
- **Rule ID resolution:** NFR-B2-1/NFR-B2-2 → requirements.md; BR-B2-OD-1/BR-B2-OD-6/BR-B2-OD-7 → business-rules.md; ADR-B2-001 · FR-B2-4 → verified in prior BLM review pass. ✓
- **Threat notes sufficient:** path traversal (guardPath), network exfil (no I/O), PII (none) — appropriate for a local-only pure library. ✓
- **No circular deps:** library boundary unchanged; no dashboard or docs-shell imports. ✓

A developer can implement all six security controls without returning with architecture questions.
