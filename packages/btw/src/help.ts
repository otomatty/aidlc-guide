/** Printed to stdout before a `--fork` launch (BR-3 / C-T5). */
export const FORK_CAVEAT =
  "note: --fork-session replays the mainline transcript as of its last flush to disk, " +
  "so the newest few exchanges may be missing. If the answer depends on them, use /branch " +
  "in the mainline session instead.";

export const HELP_TEXT = `btw — ask a side question without disturbing your mainline Claude Code session.

Every session btw starts is read-only (--permission-mode plan). There is no
option to start one any other way.

USAGE
  btw                    Open a fresh read-only session in a new terminal.
  btw --fork             Same, but forked from this project's most recent
                         session, so it starts with the mainline context.
  btw -p "<question>"    Ask one question headlessly; the answer is printed
                         here and btw exits with Claude's exit code.
  btw --help, -h         Show this text.

KNOWN LIMITATION OF --fork
  --fork resolves the newest .jsonl under
  ~/.claude/projects/<slug-of-cwd>/ and hands it to claude --fork-session.
  That transcript is only current as of its last flush to disk, so a fork
  taken while the mainline session is mid-turn can be missing the most
  recent exchanges — the very ones you are probably asking about.

  When the question genuinely depends on the live conversation, prefer
  /branch inside the mainline session. That is the first-choice route; --fork
  is the fallback for when you want a separate terminal.

NOTES
  Requires the claude CLI on PATH. Supported on macOS and Windows.
  btw never writes to your repository or to any aidlc/ artifact, and never
  reads the contents of your session transcripts — only their names and
  modification times.
`;
