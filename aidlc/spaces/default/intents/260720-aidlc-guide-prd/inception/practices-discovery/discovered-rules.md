# Discovered Rules — AIDLC Guide

> ステージ: practices-discovery (Inception 2.2) / 作成日: 2026-07-22
> 人間との対話（affirmation gate, Q6）で確定済み。`project.md`
> Mandated/Forbidden への昇格待ち。

## Mandated

- ALWAYS treat `aidlc/spaces/<active-space>/` and any application repo as
  **read-only**, except writing `[Answer]:` lines into `*-questions.md` files
  (出所: C-T2 / NFR-1 — 読み取り専用の原則)
- ALWAYS run on `bun` only as the runtime — no database, no additional
  runtime/process manager (出所: C-T1 / NFR-5)
- ALWAYS detect the target workspace's State Version before parsing; show an
  explicit "unsupported / cannot parse" state for anything other than the
  current directory structure (出所: C-T3 / NFR-6)
- ALWAYS support both Windows (including Git Bash) and macOS code paths —
  no OS-specific assumptions in path handling or process spawn (出所: C-T4 /
  NFR-4)
- ALWAYS default the Mob-mode server to bind loopback (`127.0.0.1`), not
  `0.0.0.0`; LAN exposure requires an explicit `--host` flag, and the
  `--host` path must print a startup warning naming what is being exposed
  (rendered aidlc artifacts/audit content may contain user-pasted secrets —
  LAN exposure is a data-disclosure event, not just a port-open event)
  (出所: C-T6 / NFR-7; devsecops-agent contribution)
- ALWAYS meet the measured performance targets against the tb-lxp fixture
  (~593 files): startup→first render ≤3s, change→reflect ≤2s (出所: C-T7 /
  NFR-2, NFR-3)
- ALWAYS commit and pin the bun lockfile (`bun.lock`/`bun.lockb`) as the
  source of truth (出所: devsecops-agent contribution, supply-chain hygiene;
  confirmed Q6)
- ALWAYS run `bun audit` (or `bun pm audit`) in the local quality gate;
  a known vulnerability in a direct dependency fails the gate the same way a
  lint failure does (出所: devsecops-agent contribution; confirmed Q6)

## Forbidden

- NEVER add cloud/AWS service dependencies or account-management features —
  this is a local-only tool (出所: intent-statement 初期スコープの手がかり /
  project.md 決定事項「クラウド・AWSを一切使用しない」)
- NEVER write to aidlc-workflows artifacts, state files, or audit logs from
  this tool, other than the `[Answer]:` exception above (出所: C-T2 / NFR-1)
- NEVER modify aidlc-workflows core (engine, stage definitions, audit log
  format) as part of this project (出所: constraint-register スコープ制約)
- NEVER introduce a runtime other than bun, or add a database (出所: C-T1;
  confirmed Q6 — dev-time tooling such as Vitest is not a shipped runtime and
  does not violate this rule, see evidence.md)
- NEVER assume `--fork-session` JSONL reflects the mainline conversation up
  to the current moment — it is only current as of the last flush; must be
  documented as a known limitation, not silently relied upon (出所: C-T5 /
  FR-3.4)
