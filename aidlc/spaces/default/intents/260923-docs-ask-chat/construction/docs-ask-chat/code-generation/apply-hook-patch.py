# patch script — applied via shell from record
from pathlib import Path

SRC = Path("packages/dashboard/src/features/docs/hooks/useDocsQa.ts")
text = SRC.read_text(encoding="utf-8")

# insert imports after docs-qa import
old_imp = 'import { DocsQaError, docsQaApi } from "@/services/docs-qa.ts";'
new_imp = '''import { DocsQaError, docsQaApi } from "@/services/docs-qa.ts";
import { vsCodeApi } from "@/services/vscode-api.ts";
import { docsQaAskHistory } from "@/features/docs/hooks/docs-qa-history.ts";'''
if old_imp not in text:
    raise SystemExit("import missing")
if "docsQaAskHistory" not in text:
    text = text.replace(old_imp, new_imp, 1)

old_hist = '''        history: turns
          .filter((turn) => turn.phase === "completed")
          .slice(-3)
          .map((turn) => ({ question: turn.question, answer: turn.answer.slice(0, 6000) })),'''
new_hist = "        history: docsQaAskHistory(turns),"
if old_hist not in text:
    # already patched or different formatting
    if "docsQaAskHistory(turns)" not in text:
        raise SystemExit("history block missing")
else:
    text = text.replace(old_hist, new_hist, 1)

# inject restore/persist if missing
marker = "  const lastRefreshKey = useRef(0);"
inject = '''  const lastRefreshKey = useRef(0);
  /** Host restore must land before we write back — never wipe on first paint. */
  const restoredRef = useRef(false);
'''
if "restoredRef" not in text:
    if marker not in text:
        raise SystemExit("lastRefreshKey missing")
    text = text.replace(marker, inject, 1)

    block = '''
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (typeof data !== "object" || data === null) return;
      const msg = data as Record<string, unknown>;
      if (msg.type !== "docs-conversation") return;
      const state = msg.state;
      if (typeof state !== "object" || state === null) return;
      const row = state as Record<string, unknown>;
      if (typeof row.draft !== "string" || !Array.isArray(row.turns)) return;
      const restored = row.turns.flatMap((item) => {
        if (typeof item !== "object" || item === null) return [];
        const turn = item as Record<string, unknown>;
        if (typeof turn.id !== "string" || typeof turn.question !== "string") return [];
        if (typeof turn.answer !== "string" || !Array.isArray(turn.citations)) return [];
        return [
          {
            id: turn.id,
            question: turn.question,
            answer: turn.answer,
            citations: turn.citations as import("@aidlc-guide/shared-types").DocsQaCitation[],
            tool: "claude" as const,
            phase: "completed" as const,
            createdAt: 0,
          },
        ];
      });
      setTurns(restored);
      setDraft(row.draft);
      restoredRef.current = true;
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!restoredRef.current) return;
    const api = vsCodeApi();
    if (api === null) return;
    api.postMessage({
      type: "docs-conversation",
      state: {
        turns: turns.map((turn) => ({
          id: turn.id,
          question: turn.question,
          answer: turn.answer,
          citations: turn.citations,
        })),
        draft,
      },
    });
  }, [turns, draft]);
'''
    anchor = '''  useEffect(() => {
    if (!open) return;
    let stale = false;
    const recheck = lastRefreshKey.current !== refreshKey;'''
    if anchor not in text:
        raise SystemExit("open effect missing")
    text = text.replace(anchor, block + "\n" + anchor, 1)

SRC.write_text(text, encoding="utf-8")
print("patched", SRC)
