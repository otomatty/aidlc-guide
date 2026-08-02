**Collaborator:** aidlc-developer-agent

## Contribution

Mob Round 2 — re-read revised `stories.md` against Round 1 OBJECTs (map boundary, locale store pin, Medium sizing).

Lead folded Construction pins under US-B3-01 and annotated Medium sizing. All three knowledge/judgment objections are satisfied for Inception exit; remaining API naming (message type, exact preference store among globalState/AppState/equivalent, exact map consumption path among host/api-core/shared-types) correctly deferred to Functional Design.

### Pin verification

| Round 1 OBJECT | stories.md disposition | Verdict |
|----------------|------------------------|---------|
| Map import ban + allowed boundary (not bridge `doc.deepLink`) | Construction pin: no `@aidlc-guide/official-docs` import from dashboard; host / api-core / shared-types re-export; US-B3-03 inherits same pin | Resolved |
| Locale preference store + deep-link `locale` | AC carries `locale` on deep-link target; Construction pin requires one persisted store (globalState / AppState / equiv.); Shell-only `useState` insufficient unless FD chooses it | Resolved |
| US-B3-01 explicitly Medium | Header: Medium（dashboard emit + extension host handler + Shell locale land） | Resolved |

### Still sound (unchanged AGREE)

- Q1–Q6 plan, FR→stories, Won't = B4/B5/Bolt2/slug-expand
- Dep spine `{02,03,04} → 01 → 05 → 06`; US-B3-04 as Tiny map lock
- US-B3-02 Tiny label; US-B3-06 check matrix C1–C6 without new 95% floor
- openOfficialDoc message type / command string → FD (FR-B3-1.4)

### Implementability note (non-blocking)

Pins are Open-shaped (enumerate allowed options) rather than a single chosen Then — appropriate for user-stories; Units must not invent a fourth map path or a third locale store. No further story edit required from developer.

## Positions

- AGREE: Q1–Q6 plan (P2-primary, FR→stories, Must = FR-B3-1…6, GWT, INVEST-thin, Won't = B4/B5/Bolt2/slug-expand).
- AGREE: Dep spine US-B3-02/03/04 → US-B3-01 → US-B3-05 → US-B3-06; US-B3-04 as map lock.
- AGREE: US-B3-02 Tiny; US-B3-06 verify+demo under `bun run check` without new 95% floor (NFR-B3-3).
- AGREE: openOfficialDoc message type deferred to Functional Design (FR-B3-1.4).
- AGREE: Construction pin on map consumption (no dashboard→official-docs import; allowed host/api-core/shared-types; not bridge `doc.deepLink`) — addresses Round 1 OBJECT.
- AGREE: Construction pin on one last-used official-docs locale store + deep-link `locale` land — addresses Round 1 OBJECT.
- AGREE: US-B3-01 sized Medium (dashboard emit + extension host handler + Shell locale land) — addresses Round 1 OBJECT.
