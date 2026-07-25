# btw

Ask a side question without disturbing your mainline Claude Code session.

```
btw                    # fresh read-only session, new terminal
btw --fork             # same, forked from this project's newest session
btw -p "<question>"    # one headless question, answered here
btw --help
```

Every session `btw` starts is read-only (`--permission-mode plan`). There is no
code path that starts one any other way — `basePlanArgs` in `src/plan.ts` is
concatenated by every launch plan, and the tests assert it for all three modes.

## Install

Requires [bun](https://bun.sh) and the `claude` CLI on `PATH`.

```
bun install
bun link                     # from packages/btw, to get `btw` on your PATH
```

Or run it directly: `bun run packages/btw/src/cli.ts --help`.

## Known limitation of `--fork`

`--fork` resolves the newest `*.jsonl` under
`~/.claude/projects/<slug-of-cwd>/` and passes it to `claude --fork-session`.
That transcript is only current **as of its last flush to disk**, so a fork
taken mid-turn can be missing the most recent exchanges. When the question
depends on the live conversation, use `/branch` inside the mainline session
instead; `--fork` is the fallback for when you want a separate terminal.

## Verified against

The cwd → project-slug rule (`\` `/` `:` `.` → `-`) is an internal Claude Code
convention, not a documented API (external-dependency-map E3). If it drifts,
`btw --fork` fails with the path it computed printed verbatim, so you can diff
it against the real directory.

| Claude Code | Platform | Date | Result |
|---|---|---|---|
| 2.1.215 | Windows 11 (Git Bash) | 2026-07-25 | slug + newest-session resolution confirmed against the live `~/.claude/projects` tree |
| — | macOS | — | pending manual smoke (R-BTW-4) |

## What it never does

- Writes nothing — not to your repo, not to `aidlc/`, not a log file. Output is
  stdout/stderr only.
- Never opens a session transcript. It reads directory entries and mtimes only;
  transcripts can contain sensitive text.
- Your prompt never touches a shell. `btw -p "<prompt>"` runs `claude` directly
  via `Bun.spawn` with an argv array, so a prompt containing `$(...)`, backticks
  or `&&` is one literal argument.
- The one place a command string is built is the macOS terminal launcher
  (`osascript ... do script`), which needs one. Only the cwd and a
  filesystem-derived session id ever reach it — both single-quoted and covered by
  metacharacter tests. User-supplied prompts never do: `-p` runs inline and
  short-circuits before the OS branch.
