# Component Dependency — Docs i18n Bolt 2

> ステージ: application-design / 2026-08-01  
> 上流: [components.md](./components.md) · [architecture.md](../../../codekb/aidlc-guide/architecture.md) · [component-inventory.md](../../../codekb/aidlc-guide/component-inventory.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md)  
> 親マトリクスを継承。Bolt 2 で変化するのは **データの意味**（notice/anchor/path）であり DAG ではない。

## Dependency matrix (unchanged topology)

| ↓ depends on → | official-docs | api-core | dashboard | vscode-ext | core-utils | shared-types |
|----------------|:-------------:|:--------:|:---------:|:----------:|:----------:|:------------:|
| official-docs | — | | | | ✓ | ✓ |
| api-core | ✓ | — | | | | ✓ |
| dashboard | ✗ | wire | — | wire | | ✓ |
| vscode-extension | | in-proc | embeds | — | ✓ | ✓ |

**Forbidden:** `dashboard → official-docs` (direct).

## Communication patterns

| Edge | Pattern | Bolt 2 data |
|------|---------|-------------|
| dashboard ↔ host/api-core | Sync | `OfficialDocsPage` including `notice`, `anchorApplied`, stable `path` |
| api-core → official-docs | In-process sync | Resolved page → wire DTO pass-through |
| official-docs → FS | Sync bounded read | en/ja trees under locale root |

No async event bus.

## Data flow (locale switch)

```text
User toggles LocaleControl (ja)
        │
        ▼
dashboard requests GET /api/official-docs/ja/<path>[#anchor]
        │
        ▼
api-core → official-docs.resolvePage
        │
        ├─ ja exists → localeServed=ja, notice absent, anchorApplied=…
        └─ ja missing → localeServed=en, notice=missing_ja, path unchanged
        │
        ▼
dashboard: render body + optional status banner; apply focus per anchorApplied
           LocaleControl stays on ja (localeRequested)
```

## Shared resources

| Resource | Owner | Bolt 2 note |
|----------|-------|-------------|
| `docs/guide\|reference/<locale>/` | Repo | official-docs only via guardPath |
| `OfficialDocsPage` type | shared-types | No rename (FR-B2-4.3) |
| Locale preference | vscode-extension | Control mirrors requested locale |
| Coverage config | root `check` | Includes resolve/roots/markdown (NFR-B2-1) |

## Integration points (Construction)

| From unit | To unit | Contract |
|-----------|---------|----------|
| official-docs | api-core | ResolvedPage fields ≡ OfficialDocsPage |
| api-core | dashboard | Wire JSON; UI does not invent notice |
| docs-shell (UI) | vscode-extension | Extension-only acceptance surface |

## Review

**Verdict:** READY — see full review in [components.md § Review](./components.md#review).

Dependency topology is acyclic and correct. `dashboard ✗ official-docs` forbidden edge stated. Prior F1/F2 blockers originated in component-methods.md and are now resolved; this file was structurally clean throughout.
