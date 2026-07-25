# Security Requirements — Unit: ops-guides

> nfr-requirements (3.2) / Unit: ops-guides (kind: spec) / 2026-07-25
> 入力: functional-design/business-rules.md（BR-OG-1〜7）+ requirements.md（NFR-7, FR-7.4）+ mob-mode の security-requirements（S-MM-*）
> 注: kind:spec のため produces は security + tech-stack（性能・スケール・信頼性は実行体を持たない文書 Unit に非該当）。本 Unit の「セキュリティ」= **運用者に正しい判断をさせる記述義務**。

## 要件

| ID | 要件 | 出所 | 検証 |
|----|------|------|------|
| S-OG-1 | **トンネル公開の節に認証注意を必ず含める**（本ツールは認証を持たない → 公開前に認証を掛けるのは運用側の責任、という因果を明記。「気をつけて」だけの記述は不可） | NFR-7 / FR-7.4 / BR-OG-2 | 節の存在 + 因果記述のレビュー |
| S-OG-2 | **`--host` が「データ開示イベント」であることを明記**（ポート開放ではなく、成果物・監査内容が同一 LAN の全端末から読める。mob-mode の脅威メモと同じ語彙で書く） | mob-mode 脅威メモ / S-MM-2 / BR-OG-6 | 文言レビュー（S-MM の警告文と整合） |
| S-OG-3 | **ガイドに秘密情報を書かない**（サンプルの URL・トークン・ホスト名は明らかなプレースホルダにする。実在の社内ホスト名・IP を例示しない） | 一般的な文書衛生（S-MM-4 の「内部情報を出さない」と同趣旨） | 文書スキャン（実在ホスト名・IP・トークン様文字列の不在） |
| S-OG-4 | **フックのサンプルが安全**（G-2 の自動 push フックは対象ブランチ・対象パスを明示し、無条件の `git push --force` 等を含めない） | BR-OG-4 / BR-OG-7（コピペ実行される前提） | サンプルコードのレビュー |
| S-OG-5 | **公開範囲の選択肢と結果を対比で示す**（loopback / LAN / トンネル の3段階で「誰が見えるか」を表にする — 運用者が明示的に選べるように） | NFR-7（明示的な選択の支援）/ BR-OG-2 | 表の存在 |

## 位置づけ

本 Unit はコードを持たないため攻撃面はゼロ。ただし**ガイドの記述ミスが実際の情報漏洩につながる**（誤った公開手順を書けば、それがそのまま実行される）ため、記述義務をセキュリティ要件として扱う。

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-25

- **Documentation-as-security framing is sound.** "攻撃面はゼロ" is immediately qualified by "記述ミスが実際の情報漏洩につながる" — this is not claiming zero risk, it's correctly scoping the risk to *authoring error* rather than *code vulnerability*, which is the accurate framing for a kind:spec unit with no runtime component. Each S-OG-* row pairs a requirement with a concrete, human-executable 検証 method (節の存在, 文言レビュー, 文書スキャン, サンプルレビュー, 表の存在) — none require tooling this local-only project doesn't have (no CI, no secret-scanner is asserted; "文書スキャン" reads as manual grep/review, not a claimed automated capability).
- **Vocabulary consistency with mob-mode confirmed by direct text match.** mob-mode's `security-requirements.md` threat memo (`construction/mob-mode/nfr-requirements/security-requirements.md`) states `--host` は「データ開示イベント」（ポート開放ではなく）。同一 LAN の全端末が aidlc 成果物・監査内容を読める and explicitly defers auth caution to "ops-guides — NFR-7". S-OG-2 here uses the identical framing and vocabulary (データ開示イベント / 成果物・監査内容), and S-OG-1 is exactly the auth-caution obligation mob-mode's threat memo points at. The two units' security requirements cross-reference each other correctly in both directions — no dangling or contradicted claim.
- **NFR-7 / FR-7.4 chain resolves end to end.** requirements.md FR-7.4 AC ("トンネル手順と認証注意が記載されている") and NFR-7 ("トンネル公開時の認証は運用ガイドで注意喚起") both route through business-rules.md BR-OG-2 → domain-entities.md's G-1 "リモート参加（トンネル公開）" 節 → S-OG-1 here. Every link in the chain names the same obligation; nothing is invented or dropped.
- **tech-stack-decisions.md is coherent with team.md's local-only gate.** "ローカル品質ゲートに文書 lint は入れない" does not contradict team.md's gate composition (test suite + coverage floor + Biome lint/format + `tsc --noEmit`) — Biome does not lint Markdown content correctness, so omitting a markdown-lint step from the gate is consistent with the existing tooling rather than a claimed shortcut. The "配置 = リポジトリ内 docs/guides/" / "本ツールに組み込まない" decisions match PRD §8 and business-rules.md G-1/G-2's framing of the guides as static documents, not tooling.
- **Non-blocking: 要件表 has no explicit 出所 (source) column.** Unlike business-rules.md (same unit, upstream stage), which carries an 出所 column tracing every BR-OG-* to its origin, this table's S-OG-2 (データ開示イベント framing) and S-OG-5 (loopback/LAN/tunnel 比較表) aren't cited against a specific BR-OG-* or domain-entities checklist row — they're defensible as this stage's expected NFR-level elaboration (nfr-requirements is where such specificity is supposed to be added over functional-design), and S-OG-2 is directly traceable to BR-OG-6's "実装文言との一致" via the G-1 "Dashboard の併用" 節, but a reader can't see that without cross-referencing. Adding a 出所 column matching business-rules.md's convention would remove the ambiguity; not blocking for a docs unit.
- **Non-blocking: one unverifiable cross-reference.** tech-stack-decisions.md's "参照される外部製品" row cites "external-dependency-map の非該当欄と整合" — that file is outside this review's pass-list (not one of the contracts supplied), so the claim could not be checked here. Flagging for the record only; nothing in the reviewed artifacts contradicts it.

---

## §13 Learnings（ステージ全体・回答済み — 2026-07-25）

- A. c1: kind別 produces の尊重 / B. c2: spec Unit のセキュリティ=記述義務 / C. c3: 予算表に検算行 / D. 残さない

[Answer]: B, C（project.md ## Way of Working へ永続化。c1 は memory.md 保持）

追加メモ（Anything to add for next time?）: Nothing to add

[Answer]: Nothing to add
