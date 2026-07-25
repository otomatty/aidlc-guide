# Performance Requirements — Unit: btw

> nfr-requirements (3.2) / Unit: btw (kind: service, S) / 2026-07-23
> 入力: business-logic-model.md（F1〜F4 フロー）+ business-rules.md + requirements.md（NFR-2/3 の適用範囲確認）

## 適用範囲の確認

PRD の定量目標 NFR-2（起動→初回表示3秒）/ NFR-3（変更→反映2秒）は **Dashboard 系の要件であり btw には適用されない**（requirements.md の AC は Dashboard を対象と明記）。btw 固有の性能要件を以下に定義する。

## 要件

| ID | 要件 | 測定 |
|----|------|------|
| P-BTW-1 | `btw` / `btw --fork` はコマンド投入から spawn 完了（新ターミナル起動開始）まで **2秒以内**（bun 起動 ~20ms + spawn。`--fork` のみ JSONL 走査が加わる。ユーザーが「即座」と感じる範囲） | 手動計測（OS別スモーク時に確認） |
| P-BTW-2 | `--fork` のセッション解決（JSONL mtime 走査）はセッション数 100 件でも劣化しない（ディレクトリ1回の readdir + stat のみ、全ファイル読み込み禁止） | resolve() の実装検査（ファイル内容を読まないこと） |
| P-BTW-3 | `-p` は Claude 応答時間に支配される（btw 自身のオーバーヘッドは実質ゼロ、透過実行） | — 目標値なし（外部依存） |

## 非目標

スループット・並行実行・キャッシュは対象外（ワンショット CLI、状態なし — domain-entities.md）。

## Review

**Verdict:** READY

**Reviewer:** aidlc-architecture-reviewer-agent

**Date:** 2026-07-23

- **Scope-out of NFR-2/3 checked against requirements.md — correct.** requirements.md's NFR-2 AC ("*Given* tb-lxp 記録, *When* Dashboard をコールド起動") and NFR-3 AC ("*Given* Dashboard 表示中, *When* 単一ファイルを変更") are both Dashboard-scoped by their own Given clauses; performance-requirements.md's claim that these do not apply to `btw` is accurate, not an unjustified opt-out.
- **All five artifacts are testable or explicitly N/A with reasons, cross-checked pairwise.** P-BTW-1/2/3 give thresholds + measurement method (P-BTW-3's "no target — external dependency" is an honest N/A, not a dodge). scalability-requirements.md's "structurally not applicable" claim is backed by domain-entities.md line 36 ("永続化なし...ファイルもストアも持たない") and line 33 ("状態遷移なし（ワンショット CLI）"), which I opened directly — the stateless claim used to justify both the performance non-goals and the scalability N/A actually holds in the artifact it cites, not just asserted.
- **Security ↔ functional-design traceability confirmed.** S-BTW-1 (plan-mode only) matches business-logic-model.md's F1/F2/F3 flows, which all show `--permission-mode plan` on every spawn variant with no non-plan code path. S-BTW-3's "JSONL content never read, only filename/mtime" matches F2's resolution flow (readdir + mtime sort, no file body access) and matches P-BTW-2's performance claim about the same operation — the same design fact is stated consistently in two independently-authored NFR files.
- **Reliability ↔ business-rules traceability confirmed.** R-BTW-1's five failure modes (CLI absent / session unresolvable / spawn failure / unsupported OS / bad args) map 1:1 to business-logic-model.md's error-handling table rows. R-BTW-5's "computed path + `/branch` alternative" requirement matches BR-2's fail-fast description and F2's literal error-message text almost verbatim — not a paraphrase drift.
- **Tech-stack zero-dependency claim is proportionate and consistent with team.md.** The "argparse is overkill for 4 options" rationale is a stated ponytail-style justification, not silent scope creep, and the Vitest/Biome dev-time tooling is correctly carved out of C-T1/NFR-5 per project.md's already-affirmed learning (cid:practices-discovery:c1) — no new contradiction introduced.
- **Minor, non-blocking observation:** P-BTW-1's overhead breakdown "(bun 起動 ~20ms + JSONL走査 + spawn)" applies the JSONL-scan cost to both `btw` and `btw --fork`, but business-logic-model.md's F1 flow (plain `btw`) does no JSONL walk — only F2 (`--fork`) does. The 2-second budget itself is unaffected (it's a ceiling, not a sum-of-parts proof), but the parenthetical rationale conflates the two commands' cost profiles. Worth a one-line fix, not a readiness blocker.
- **Minor, non-blocking observation:** S-BTW-2's injection-defense claim is correctly scoped to `-p`'s user-controlled prompt (F3, direct `claude` exec, no shell wrapper), but F1/F2's Windows path spawns via `cmd /c start` per business-logic-model.md — a launcher with its own well-known command-line reparsing quirks distinct from Bun's argv-array quoting. No untrusted input currently flows through that path (session IDs are filesystem-derived, not user-supplied), so this isn't a live vulnerability, and tech-stack-decisions.md's decision memo already commits to verifying real Windows/macOS spawn behavior at code-gen time under R-BTW-4's OS smoke test. Flagging only so the smoke test explicitly includes a path/arg with shell-metacharacters (e.g. a cwd containing `&` or spaces) as a case, not just a happy-path run.
- No circular references, no dangling IDs, no orphaned NFRs found across the five files; every P-/S-/R-BTW-* ID is unique and each artifact carries ≥2 H2 sections with an explicit upstream (`入力:`) line.
