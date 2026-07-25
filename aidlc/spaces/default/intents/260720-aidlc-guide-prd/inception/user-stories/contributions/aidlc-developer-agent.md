**Collaborator:** aidlc-developer-agent

## Contribution

Reviewed the 15-story draft through the INVEST / implementability / sizing lens, cross-checked against `intent-backlog.md` (PU-01..PU-13), `requirements.md` (FR/NFR), and `team.md` structure rules. Most stories are right-sized and buildable. Three sizing/sequencing defects matter for construction, one of them structural.

**Buildability vs. constraints — clear.** bun-only, read-only (US-14 correctly narrows writes to `[Answer]:` lines), State Version 7 (US-15 handles unsupported), cross-platform: no story is unbuildable. One cross-platform risk is under-costed (US-06, below).

**Structural finding — reader-core has no story of its own.** `intent-backlog.md` splits F-01 into PU-01 (reader-core) + PU-02 (reader-watch), and `team.md` structure rule 1 makes reader-core the UI/transport-independent pure data layer that all 3 surfaces (MCP / Dashboard / Mob) consume one-directionally — it is also the walking-skeleton Bolt 1 subject (team.md Walking Skeleton). Yet the draft folds reader into **US-09**, a story named after and framed as the *MCP* surface, and then scatters the rest of reader across dependency notes: US-01 "依存: US-09（reader）", US-10 "reader-watch", US-15 "reader-core". The single most-depended-on component ("最大の共通依存", backlog line 38) is presented as a dependency of a surface story. This inverts the architecture and makes US-01/05/10 point their dependency arrows at MCP when what they actually consume is reader-core. It also fails INVEST-Small for US-09 (reader FR-1.1/1.2/1.3/1.4 + 5 MCP tools = 3–4 units; the AC itself concedes "reader FR-1.1 が実体").

**Milestone/dependency inconsistency in the M1 chain.** `aidlc_explain_stage` and `aidlc_glossary` require docs-bridge (FR-5.1; backlog PU-08 = **M2**; PU-03 lists docs-bridge as its dependency). But US-09 and US-04 (glossary) are tagged **M1**. As written, the 5-tool US-09 and US-04 cannot complete at M1 — their docs-dependent tools have no data source until M2. The footer graph `... → US-04（glossary/docs-bridge）` at end-of-M1 makes this concrete: it needs docs-bridge one milestone early.

**Otherwise sound:** persona×job breakdown (Q1/Q2), all-Must + dependency-order (Q3), US-13's Milkdown risk framing with candidate-replacement escape, and the thin-but-legitimate btw sub-stories (US-07/08) are all fine.

## Positions

AGREE: 15-story persona×job breakdown, all-Must with M1→M4 dependency order — matches Q1/Q2/Q3 and the backlog value-stream.

AGREE: US-14 write-boundary (`[Answer]:` lines only) is correctly scoped and buildable under the read-only constraint (NFR-1/C-T2).

AGREE: US-15 fail-soft as a first-class M1 robustness concern (FR-1.6/NFR-6) — the right call; it must not be an afterthought.

AGREE: US-13 correctly carries the Milkdown validation risk with the feasibility R-2 candidate-replacement escape hatch. Suggest (non-blocking) the M3-opening 5-item fixture validation be an explicit task inside US-13's "done", not implicit, so a candidate swap doesn't silently reopen the story.

AGREE: US-06/07/08 (btw / --fork / -p) are genuinely small and estimable; keeping them split per Q2 is correct, not over-decomposition.

OBJECT [knowledge]: reader-core is absent as its own story. team.md structure rule 1 mandates reader-core as the pure data layer the 3 surfaces consume one-directionally, and it is the Bolt 1 walking-skeleton subject; backlog isolates it as PU-01 (+PU-02 reader-watch). Split US-09 into **US-09a reader-core** (FR-1.1/1.2/1.3/1.4, plus reader-watch FR-1.5 which currently only surfaces as US-10's orphan "reader-watch" dependency) and **US-09b mcp-server** (the 5 read-only tools). Then re-point US-01/US-05/US-10 dependencies at reader-core, not at the MCP story. This restores the "1 library / 3 surfaces" shape in the story map itself.

OBJECT [knowledge]: US-09 and US-04 milestone/dependency conflict. `explain_stage` + `glossary` (and US-04) depend on docs-bridge, which requirements/backlog place at M2 (FR-5, PU-08), but these stories are tagged M1 — so they cannot complete at M1 as written. Resolve by either (a) splitting the two docs-dependent MCP tools out to M2 alongside docs-bridge (status/next_steps/read_artifact stay M1), or (b) pulling a minimal docs-bridge correspondence table into M1. Fix the milestone tags on US-04 and US-09 to match whichever is chosen.

OBJECT [judgment]: US-12 is a 3-in-1 epic with a disjunctive AC. It bundles FR-7.4 tunnel + FR-8.1 Live Share + FR-8.2 async-share — three independent deliverables spanning F-07 and F-08 — and its AC reads "トンネル…または Live Share または非同期", so the story passes on any single path. That is non-atomic and fails Estimable/Testable. Split into three (tunnel / Live Share / async-share), or at minimum make the AC conjunctive (all three documented). Backlog already separates these (PU-13 + FR-7.4).

OBJECT [judgment]: US-15 is sequenced *after* US-09 in the footer graph, but fail-soft is a reader-core facet (PU-01: "State Version 検知・解析不可フォールバック") that must exist *before* any surface can safely return "解析不可". Once reader-core becomes its own story (objection 1), US-15 is an AC/sub-story of reader-core, not a downstream node. Re-anchor the M1 chain so fail-soft rides with the reader, not behind MCP.

OBJECT [judgment]: US-06 under-costs a cross-platform terminal-spawn matrix. "読み取り専用のサイドセッションを別ターミナルに起動" hides materially different launch mechanics per OS/emulator (Windows Terminal / cmd / Git Bash vs macOS Terminal / iTerm), and NFR-4/C-T4 require both OSes — but no AC covers the OS matrix. Add an OS-matrix AC (or a spike task) to US-06; as written it is optimistically estimated.
