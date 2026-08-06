**Collaborator:** aidlc-developer-agent

## Contribution

Code-style / boundary check for Bolt 4. Reuse Bolt 3 `open-official-doc` host contract; do not add a parallel landing path. Keep official content loader in `api-core` / `official-docs`; dashboard remains wire-only. Bridge degrade is a UI contract change in `dashboard` (+ optional host message reuse), not a new package.

### Boundaries

- ALWAYS call existing `open-official-doc` from Bridge primary CTA.
- NEVER mount `doc.excerpt` as canonical article after US-06.
- NEVER put docs loader logic in `dashboard` or `reader-core`.

## Positions

AGREE: Inherit team.md Code Style + Q2 = A.  
OBJECT: None
