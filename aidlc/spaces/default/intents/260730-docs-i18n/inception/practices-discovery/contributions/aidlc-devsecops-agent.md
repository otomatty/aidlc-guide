**Collaborator:** aidlc-devsecops-agent

## Contribution

DevSecOps review of the Practices Discovery lead draft for `260730-docs-i18n`.
Verdict: the brownfield security baseline (Biome walls, `guardPath`, pinned
lockfile, `bun audit` in `bun run check`, loopback Mob default, no cloud) is
sound and correctly carried forward. Docs-i18n does **not** justify a new SAST
platform, secret-scanning pipeline, or cloud security stack. The new risk is
narrow: **bundled third-party markdown trees + locale-scoped path serving +
VSIX packaging**, on top of a still-thin extension-host test suite (D8).

### 1. Lint/format (Biome) — confirm, do not expand

Agree with Code Style / Mandated: Biome remains the single lint+format tool and
the practical structural SAST (`noRestrictedImports` for write-FS and package
firewalls). No Sonar/CodeGuru/Semgrep layer is warranted for a local read-only
tool.

- **`docs/` ignored by Biome** (`biome.json` `!docs`) is correct: upstream
  snapshot markdown must not be reformatted by our formatter. Document that
  content integrity (front matter, links) is a pipeline concern, not a Biome
  concern — the draft already says this; keep it explicit at affirmation.
- **`packages/vscode-extension/media` ignored** stays a silent zone for
  committed webview/build artifacts. Size drift is already called out; also
  treat unexpected binaries in media as a packaging hygiene check when VSIX
  size assertion lands (see §4).
- Keep Biome security-adjacent defaults that cost nothing (no `eval` /
  dynamic `Function`, careful process spawn). Locale loaders must not introduce
  shell-interpolated paths.

### 2. Dependency / secret scanning — keep bun-native; watch content intake

Mandated rules already pin `bun.lock`/`bun.lockb` and fail the gate on
`bun audit` for known-vuln **direct** deps. CI uses `bun install --frozen-lockfile`
and `permissions: contents: read` — correct least-privilege for a check-only
workflow. Do not add Snyk/Inspector/Dependabot as a practices requirement.

Gaps relative to docs-i18n (not new platforms — practices wording):

- **Prefer zero new runtime deps for locale switching** (dependencies.md /
  draft inference #2) should stay a hard supply-chain preference: content-tree
  switching only; any sync/diff tooling stays out of the extension runtime.
- **Secret scanning of application source remains YAGNI** (tool still holds no
  credentials). Nuance for this intent: M5 upstream snapshot + M3 translation
  PRs can introduce pasted tokens inside markdown. That is a **content review**
  control (human PR gate already required for M3), not a Gitleaks mandate.
  One line in Deployment / Way of Working notes is enough: reviewers reject
  credential-shaped strings in snapshot/translation diffs.
- Do not weaken `bun audit` when packaging grows; `@vscode/vsce` and mermaid /
  marked remain the heavy transitive surface — bumps re-trigger audit.

### 3. Supply-chain — lockfile + audit + no parallel package managers

Agree: single gate (`bun run check` includes `bun audit`); CI mirrors it and
must not add/reorder/relax steps. For docs-i18n specifically:

- Upstream markdown is **untrusted content**, not trusted code. Rendering via
  existing `marked` / mermaid stack must stay HTML-sanitized / as-safe-as-today;
  do not introduce a second renderer for ja content.
- Locale codes and tree roots are allowlisted (`en`/`ja` once Q-Style-1/2
  affirm) — do not accept arbitrary `:locale` strings that become path
  segments before `guardPath`.
- No second package manager, no unpinned `latest` ranges, no shipping optional
  sync CLIs inside the VSIX.

### 4. VSIX packaging risks — size is necessary but not sufficient

Agree with Deployment / Q-Test-2 / Q-Deploy-1: VSIX (and committed media) size
needs a threshold wired into `bun run check` (or a chained `check:size`). From
a security/packaging lens, add these practice notes when affirming:

- **Budget is a regression gate**, not a security scanner — still required so
  silent media growth cannot land unnoticed.
- **Package contents stay intentional**: `vsce package` must not pull workspace
  secrets, `.env*`, `aidlc/` runtime, or developer-local paths. Prefer an
  explicit include/exclude list owned by `packages/vscode-extension` (already
  the packaging root).
- **Dual-locale content increases blast radius of a bad path** inside the
  extension host (`open-doc` / webview asset resolution). Size checks do not
  substitute for path-containment tests (next section).
- Mermaid chunks already committed under media amplify the cost of every
  additional docs tree — prefer not shipping unused locale trees in first paint
  (aligns with code-quality D5).

### 5. Path containment for bundled docs — elevate from quality debt to control

Strongly endorse Mandated: ALWAYS route docs content reads through the single
`guardPath` in `core-utils` (realpath + traversal + symlink escape). This is the
primary control for locale-scoped routes and extension `open-doc`.

Additions the lead should integrate (practices / Mandated or Testing Posture):

- **Allowlist locale + normalize `:path` before join**, then `guardPath` against
  the locale root — defense in depth if a caller concatenates wrong.
- **NEVER ad-hoc `path.relative` / string prefix checks** for the new trees
  (already implied; keep Forbidden-adjacent wording for docs-i18n handlers).
- **Extension-host tests for containment are a security gate item**, not only
  D8 quality debt: at least traversal (`../`), absolute path, and symlink-escape
  cases for locale-qualified open-doc / docs API. Thin vscode-extension suite
  (2 files) is the highest residual risk for this intent.
- New api-core docs routes inherit the same containment contract as
  `/api/guides`; distinct route prefix (Q-Style-3) must not mean a second
  containment implementation.
- Cross-platform: `path.join` / `vscode.Uri` only — Mandated C-T4 already
  covers this; bundled VSIX paths make it load-bearing.

### 6. CI posture — keep mirror, treat first green as acceptance

Agree with evidence inference #7 / Q-Deploy-2: `check.yml` is not yet remotely
verified; first docs-i18n PR is the natural acceptance run. Do not invent
separate security jobs. When verified, keep `permissions: contents: read` and
the LF pre-checkout step (Biome LF is also a reproducible-build hygiene item).

## Positions

- AGREE: Biome as sole lint/format + package/FS firewall; ignoring `docs/` for
  upstream markdown is correct — do not Biome-format snapshot trees.
- AGREE: Lockfile pin + `bun audit` inside `bun run check` (and frozen CI
  install) are sufficient supply-chain gates — no Snyk/Inspector mandate.
- AGREE: Single `guardPath` enforcement for all new docs reads; dual-transport
  api-core handlers; no reader-core→dashboard edge — preserves trust boundaries.
- AGREE: VSIX/media size assertion belongs in the single quality gate
  (Q-Test-2 / Q-Deploy-1) — silent packaging growth is a real regression risk.
- AGREE: Zero new i18n runtime frameworks; content-tree locale switching — keeps
  supply-chain surface flat.
- OBJECT: Draft frames extension path-containment undertest as quality debt
  (D8) only — for docs-i18n it is a **security control gap**. Affirm a Testing
  Posture / Mandated expectation: locale-qualified open-doc + docs API must
  cover traversal/absolute/symlink-escape cases before Construction claims the
  gate green.
- OBJECT: Draft is silent that M5 snapshot / M3 translation markdown is
  **untrusted content** (credential paste, hostile relative links, renderer
  abuse). Add a short practice note: human PR review rejects secrets; locale
  param allowlisted; reuse existing markdown renderer — no second pipeline.
- OBJECT: VSIX size budget alone is incomplete packaging hygiene — affirm that
  `vsce package` contents stay scoped to intentional extension assets (no
  `.env`, no `aidlc/` runtime, no workspace secrets) when the size check is
  designed.
