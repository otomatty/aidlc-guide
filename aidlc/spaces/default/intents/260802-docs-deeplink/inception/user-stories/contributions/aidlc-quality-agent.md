**Collaborator:** aidlc-quality-agent

## Contribution

Quality Round 2 re-check against revised `stories.md` (lead integrated Round 1 quality objections).

### Objection clearance

| Round 1 OBJECT | Evidence in revised stories | Verdict |
|----------------|----------------------------|---------|
| Unmapped `path: ""` discriminant | US-B3-03 Then: omit `path`/`anchor` keys; `path: ""` not unmapped success. US-B3-01 mapped: empty/`path: ""` is Fail. US-B3-06 C3 mirrors omit-keys + empty-path fail | Cleared |
| US-B3-06 missing C5/C6 | Check matrix C1–C6 present; C5 = accessible label ≠ `Docs`; C6 = openOfficialDoc + legacy dual-spy | Cleared |
| Named spies / observables | US-B3-01: `openExternal` / `window.open` / `target=_blank` named spy; one-shot target cleared. US-B3-05: dual-spy. US-B3-03: no external open | Cleared |

### Check matrix C1–C6 (confirm)

| # | Present | Notes |
|---|---------|-------|
| C1 | Yes | Map key set + non-empty paths |
| C2 | Yes | Mapped: locale + non-empty path |
| C3 | Yes | Unmapped omit-keys; `path: ""` fails |
| C4 | Yes | Unmapped → Shell top |
| C5 | Yes | Accessible label / ≠ `Docs` |
| C6 | Yes | Mapped activate + legacy not called |

GWT remains Vitest + `bun run check` aligned; NFR-B3-3 (no new 95% branch floor) still correct. No new testability OBJECTS.

## Positions

- AGREE: Unmapped omit-keys discriminant (US-B3-03 + C3) — Matches FR-B3-1.1; `path: ""` cannot green as unmapped.
- AGREE: US-B3-06 check matrix C1–C6 — Label (C5) and legacy-off (C6) are in the gate; escape risk from Round 1 closed.
- AGREE: Named spies / dual-spy (US-B3-01 / US-B3-05) — Then clauses name observables suitable for unit/integration assertions.
- AGREE: GWT + INVEST split (US-B3-01…06) — Unchanged from Round 1; still suitable for Vitest + check.
- AGREE: Map fixture + NFR-B3-3 — Unchanged; right unit floor.
- AGREE: Demo scoped to intent-capture mapped path — Unchanged; manual/E2E oracle outside unit floor.
