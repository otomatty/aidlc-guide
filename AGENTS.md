# AI-DLC on Cursor

This project uses **AI-DLC Workflows 2.0** (GA Preview). The deterministic engine lives under `.claude/` (same distribution Claude Code uses). Cursor loads those skills from `.claude/skills/` automatically.

There is no official Cursor harness in aidlc-workflows v2. This file plus `.cursor/rules/aidlc.mdc` bridge Cursor to that engine. Prefer Claude Code for full hook/statusline support; use Cursor when you want Agent chat against the same workspace state.

## How to run

| Goal | In Cursor Agent chat |
|------|----------------------|
| Start / resume a workflow | `/aidlc <description>` or `/aidlc --resume` |
| Health check | `/aidlc --doctor` (or `bun .claude/tools/aidlc-utility.ts doctor`) |
| Status | `/aidlc --status` |
| Jump | `/aidlc --stage <slug>` / `--phase <name>` |
| Compose a plan | `/aidlc compose "<task>"` |
| Isolated stage | `/aidlc-<stage>` (e.g. `/aidlc-code-generation`) |

When the user asks to start AI-DLC / aidlc without naming a skill, read and follow `.claude/skills/aidlc/SKILL.md` immediately.

## Prerequisites

- **bun** on PATH (CLI tools + engine). Verify: `bun --version`
- Engine + workspace shell already installed: `.claude/` and `aidlc/spaces/default/memory/`
- Optional MCP: project `.mcp.json` (context7 + AWS servers via `uvx`)

## Layout (authoritative under `.claude/`)

- **Orchestrator skill**: `.claude/skills/aidlc/SKILL.md`
- **Stage runners / session skills**: `.claude/skills/aidlc-*`
- **Agents**: `.claude/agents/aidlc-*-agent.md`
- **Tools**: `bun .claude/tools/aidlc-*.ts` (especially `aidlc-orchestrate.ts`, `aidlc-utility.ts`)
- **Method (edit here)**: `aidlc/spaces/<space>/memory/` — `org.md`, `team.md`, `project.md`, `phases/*.md`
- **Artifacts / state**: `aidlc/spaces/<space>/intents/<slug>-<id8>/`

## Cursor-specific notes

1. **No Claude Code hooks in Cursor.** Session-start / PreToolUse / statusline hooks do not fire. The conductor must drive the engine explicitly via `bun .claude/tools/aidlc-orchestrate.ts next|report|park` as the skill describes. Do not invent state transitions in prose.
2. **Gates stay human-owned.** At every approval gate, stop and wait for the user. Never auto-approve.
3. **Subagents.** When a stage needs a worker or reviewer, use Cursor's Task / subagent tools with the matching persona from `.claude/agents/`. Pass the exact `rules_in_context` and artifact paths from the engine directive.
4. **AskUserQuestion.** If unavailable, present the same options as a numbered list and wait for a reply before calling `report --user-input "..."`.
5. **Do not install v1 `.aidlc-rule-details` / main-branch Cursor rules** alongside this tree — they are a different methodology and will conflict.

## Method (ambient)

Before stage work, read the active space method files (default space unless `aidlc/active-space` says otherwise):

- `aidlc/spaces/default/memory/org.md`
- `aidlc/spaces/default/memory/team.md`
- `aidlc/spaces/default/memory/project.md`
- `aidlc/spaces/default/memory/phases/ideation.md`
- `aidlc/spaces/default/memory/phases/inception.md`
- `aidlc/spaces/default/memory/phases/construction.md`
- `aidlc/spaces/default/memory/phases/operation.md`

Edit those files for team practices — never duplicate them under `.cursor/`.

## Session resume

On startup, if `aidlc/spaces/*/intents/active-intent` points at a record with `aidlc-state.md`, offer to resume (`/aidlc --resume`) rather than starting fresh unless the user asks otherwise.

## Git

Commit `aidlc/` (state, audit shards, artifacts, memory). Keep gitignored: per-user cursors, `.aidlc-clone-id`, `.aidlc-sessions/`, runtime graphs, `.claude/settings.local.json` (see root `.gitignore`).
