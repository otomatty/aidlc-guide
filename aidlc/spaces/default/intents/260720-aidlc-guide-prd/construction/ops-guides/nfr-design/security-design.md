# Security Design — Unit: ops-guides

> nfr-design (3.3) / Unit: ops-guides (kind: spec) / 2026-07-25
> 入力: nfr-requirements/security-requirements.md（S-OG-1〜5）+ functional-design/business-rules.md（BR-OG-*）+ domain-entities.md（G-1/G-2 構造）
> 注: kind:spec のため produces は security-design のみ（実行体を持たないため performance/scalability/reliability/logical-components は非該当）。本書は「記述義務をどう文書構造で担保するか」の設計。

## 設計（要件→文書上の機構）

| 要件 | 実現機構（文書のどこで担保するか） |
|------|--------------------------------|
| S-OG-1（認証注意） | G-1「リモート参加（トンネル公開）」節の**冒頭に注意ブロックを置く**（手順の後ではなく前 — 読み飛ばして実行されない位置）。因果を1文で: 「本ツールは認証を持たないため、トンネル公開はインターネットに無認証で開くことと同義。cloudflared Access / Tailscale ACL 等でアクセス制御を掛けてから公開する」 |
| S-OG-2（データ開示イベント） | G-1「Dashboard の併用」節に、**mob-mode の実装警告文をそのまま引用**（BR-OG-6 の同期義務を引用形式で機械的に満たす）+ 「これはポート開放ではなくデータ開示です」の1文を添える |
| S-OG-3（秘密を書かない） | 例示は固定プレースホルダ規約: ホスト名 **`example.com` 系（RFC 2606 予約ドメイン。`.local` は RFC 6762 の mDNS 用で実在の社内ホストと紛れるため使わない）** / IP `192.0.2.10`（RFC 5737 TEST-NET-1）/ トークン `<YOUR_TOKEN>`。**実在値を書かない**ことをレビュー観点として受入条件に含める |
| S-OG-4（安全なフック） | G-2 のフックサンプルは **(a) 対象ブランチを明示**（`main` 以外に push しない）**(b) 対象パスを明示**（push 対象は `aidlc/` 配下の記録のみ — アプリコードや他ディレクトリを巻き込まない）**(c) 無条件 `--force` を使わない** の**契約3条件**（S-OG-4 の「対象ブランチ・対象パス + force 禁止」に1:1対応）を満たす形で掲載。加えて実務上の推奨として (d) 失敗時に握り潰さない を添える。サンプル直下に「このフックがすること/しないこと」を箇条書き |
| S-OG-5（公開範囲の対比） | G-1 に**公開範囲の3段階表**を置く（下記） |

## 公開範囲の対比表（G-1 に掲載する内容の設計）

| 公開範囲 | 起動方法 | 誰が見えるか | 認証 | 推奨用途 |
|---------|---------|------------|------|---------|
| loopback（既定） | `bun run dashboard` | 自分の PC のみ | 不要 | 通常の1人作業 |
| LAN | `--host` | 同一ネットワークの**全端末**（成果物・監査内容が読める） | 無し（ツールは持たない） | 同席モブ |
| トンネル | `--host` + cloudflared/Tailscale | トンネル URL を知る**全員**（設定次第でインターネット全体） | **運用側で必須**（Access/ACL） | リモートモブ |

## 記述の同期義務（BR-OG-6 の運用設計）

- G-1 の警告文言は mob-mode の**実装が出力する文言としてブロック引用**し、引用元（`packages/dashboard-server` の警告定数）をファイル名付きで併記する。
- 同期の担保は **B7 完了時の一度きりの突合**（business-rules.md BR-OG-6 の受入条件「実装後の突合」）。**継続的なドリフト検知の仕組みは持たない**（文書 lint / CI を導入しない — tech-stack-decisions.md）。将来 mob-mode の警告文言を変更する場合は、その変更作業の中で G-1 を更新することを引用元の併記で気づきやすくするに留める（自動検知ではない）。
- B7（bolt-plan）で U8 実装完了後に G-1 を確定する順序をとる（domain-entities.md「依存とタイミング」どおり）— 実装前にガイドを書き切らないことが突合成立の前提。

## 受入検証

security-requirements.md の各行の「検証」列をそのまま使う（節の存在 / 因果記述 / 文言一致 / プレースホルダ規約 / **フックサンプルの契約3条件（ブランチ・パス・force 禁止）** / 3段階表の存在）。文書 lint は導入しない（team.md: ローカルゲートのみ、体裁より内容）。

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-25

- **S-OG-4 blocking finding resolved — all 3 contract conditions now present and correctly matched.** security-requirements.md's S-OG-4 text ("対象ブランチ・対象パスを明示し、無条件の `git push --force` 等を含めない") decomposes into exactly three obligations: explicit target branch, explicit target path, no unconditional force. security-design.md line 14 now lists (a) 対象ブランチを明示, (b) 対象パスを明示（`aidlc/` 配下のみ — アプリコードや他ディレクトリを巻き込まない）, (c) 無条件 `--force` を使わない — a 1:1 mapping, explicitly labeled "契約3条件（S-OG-4 の「対象ブランチ・対象パス + force 禁止」に1:1対応）". The prior substitution of an unrelated criterion is gone; failure-handling is now correctly demoted to "(d) 実務上の推奨" outside the contract set. The 受入検証 line (line 33) mirrors the same three conditions verbatim ("フックサンプルの契約3条件（ブランチ・パス・force 禁止）") — mechanism and acceptance line agree.
- **Sync section no longer claims automatic drift detection.** Lines 25–29 now state the sync guarantee is "B7 完了時の一度きりの突合" against BR-OG-6's 受入条件「実装後の突合」, followed by an explicit negative: "継続的なドリフト検知の仕組みは持たない（文書 lint / CI を導入しない — tech-stack-decisions.md）". The source is cited (not just described): the G-1 warning text is block-quoted from the mob-mode implementation, with 引用元 named as `packages/dashboard-server` の警告定数 "ファイル名付きで併記". No lint/CI mechanism is asserted anywhere in the doc — consistent with the 受入検証 section's own "文書 lint は導入しない".
- **Placeholder convention now RFC 2606-anchored with stated rationale.** Line 13 replaces the earlier `.local` placeholder with `example.com` 系, explicitly cited as "RFC 2606 予約ドメイン", and gives the reason `.local` was rejected: "RFC 6762 の mDNS 用で実在の社内ホストと紛れるため使わない". IP placeholder (`192.0.2.10`, RFC 5737 TEST-NET-1) and token placeholder (`<YOUR_TOKEN>`) are unchanged and were never in question.
- **No new contradictions found.** S-OG-1/2/3/5 mechanisms (rows 1, 2, 3, 5 of the 設計 table) are untouched by this revision and remain individually traceable to their security-requirements.md rows. The 公開範囲の対比表 and NFR-2/NFR-3 references elsewhere in the unit are not touched by this diff. No mechanism in this revision introduces a claim (automated tooling, CI, lint) that team.md's local-only quality gate would reject.

---

## §13 Learnings（ステージ全体・回答済み — 2026-07-25）

- A. c1: 設計しない判断も残す / B. c2: 要件→機構の対応表 / C. c3: 構造的禁止で不変条件を担保 / D. 残さない

[Answer]: B, C（project.md へ永続化。c1 は c2 に内包 + memory.md 保持）

追加メモ（Anything to add for next time?）: Nothing to add

[Answer]: Nothing to add
