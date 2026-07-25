**Collaborator:** aidlc-devsecops-agent

## Contribution

DevSecOps / supply-chain review of the lead draft. Verdict: security surface is
genuinely small for a local, read-only dev tool (C-R1: no PII/payment/health, no
regulated data). Do not over-engineer. There is exactly ONE real surface — Mob
mode network exposure — plus a supply-chain hygiene baseline. Everything else is
confirm-and-move-on.

### 1. Lint/format as security hygiene (low ceremony, agree with draft)

The draft's "Prettier + ESLint per project config" is the right altitude. No SAST
platform (CodeGuru/Sonar) is warranted for a local read-only tool — that's
over-engineering. Concrete asks the interview can confirm:
- Enable ESLint's security-relevant defaults that cost nothing: no `eval`, no
  `Function()` constructor, no `child_process` with unsanitized/shell-interpolated
  input. The tool spawns processes (bun, `--fork-session`, Mob server) and does
  cross-platform path handling, so command construction is the only injection-ish
  code path — lint it, don't build a scanner for it.
- `@typescript-eslint` with `strict` is the practical "SAST" here; TS type-checking
  catches the classes of bug that matter for a file-parsing tool.

### 2. Dependency / supply-chain scanning (the bun+npm surface)

Deps named in scope: Milkdown, chokidar, React, MCP SDK — all npm packages resolved
through bun. This is the tool's largest realistic attack surface (transitive
supply-chain), and it is entirely addressable with built-ins — no Snyk/Inspector:
- **Commit the lockfile** (`bun.lock` / `bun.lockb`) and treat it as the pinned
  source of truth. This should be a hard rule, not a suggestion — an unpinned
  local dev tool that reads your entire workflow tree is exactly what supply-chain
  attacks target.
- Run `bun audit` (or `bun pm audit`) in the same local "CI" command the draft's
  Testing Posture already defines; a known-vuln in a direct dep should fail the
  gate the same way a lint failure does. Zero new infrastructure.
- No auto-update / no `latest` ranges; bump deliberately (aligns with C-O3
  quality-over-deadline). M3's possible Milkdown swap is a dep change that should
  re-trigger the audit.

### 3. Secret scanning (confirm: nothing invites secrets)

The tool holds no credentials — correct, and the draft's read-only mandate keeps it
that way. Confirmed there is no place a secret could land: no config with API keys,
no account management (Forbidden rule already bars this), no `.env` the tool writes.
So a secret-scanning pipeline is YAGNI. One nuance worth a line in the draft, though
(see Positions OBJECT-1): the tool *renders* aidlc artifacts and audit/JSONL that a
user may have pasted secrets into. The tool doesn't create the secret, but Mob-mode
LAN exposure can *broadcast* it. That reframes secret handling from "scan our code"
(unnecessary) to "don't rebroadcast the workspace to the LAN by default" (the
localhost rule, which the draft already has).

### 4. Mob mode — the one real security surface (lock the defaults hard)

`discovered-rules.md` already mandates localhost-default + explicit LAN flag (C-T6 /
NFR-7). Strongly endorse; this is the correct and sufficient control. Tighten it so
the rule is unambiguous at implementation time:
- Bind to loopback (`127.0.0.1`), **not** `0.0.0.0`, by default. "localhost default"
  must mean the socket physically cannot be reached off-box until `--host` is passed.
- LAN exposure is a data-disclosure event, not just a port-open event, because it
  serves rendered workflow artifacts (see §3). The `--host` path should print a
  one-line warning at startup naming what's being exposed and to whom. Cheap,
  operator-facing, no auth machinery.
- Tunnel auth is correctly the operator's responsibility per F-08 運用ガイド (C-R2).
  Agree it stays documentation, not code — building auth into a localhost dev tool
  would be the over-engineering trap. The F-08 guide must state plainly: LAN/tunnel
  exposure serves read-only workflow content unauthenticated; the operator owns the
  network boundary.

### 5. Read-only write-boundary as a security control (not just a functional one)

The `[Answer]:`-only write exception (C-T2 / NFR-1) is effectively the tool's
authorization model. Treat it as a hard security boundary: a single, auditable write
path with a whitelist of target files (`*-questions.md`) and a whitelisted line
form. Everything else on disk is read-only. This should be enforced in one place
(one guarded writer function), not re-checked at each call site — a single choke
point is both the lazy implementation and the correct security implementation.

## Positions

- AGREE: Localhost-default + explicit-LAN-flag for Mob mode (discovered-rules
  Mandated). Correct and sufficient; no auth layer needed for a local dev tool.
- AGREE: Read-only mandate with the single `[Answer]:` write exception is the right
  authorization boundary; no secret-scanning pipeline needed since the tool holds no
  credentials.
- AGREE: No cloud/AWS deps (Forbidden) — also removes the entire cloud-secrets /
  IAM / KMS surface, correctly out of scope.
- OBJECT: The draft is silent that Mob-mode LAN exposure *rebroadcasts rendered
  workflow artifacts/audit content* (which may contain user-pasted secrets), not
  just "opens a port." Add to team-practices/F-08 that `--host` is a data-disclosure
  decision and must print a startup warning; bind loopback (127.0.0.1), never
  0.0.0.0, by default.
- OBJECT: Supply-chain hygiene should be a hard rule, not left to "repo config."
  Recommend two Mandated rules: (a) ALWAYS commit and pin the bun lockfile; (b)
  ALWAYS run `bun audit` in the local test/CI gate and fail on known-vuln direct
  deps. Currently absent from discovered-rules.md.
