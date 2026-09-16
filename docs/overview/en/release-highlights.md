# aidlc-workflows release highlights

This guide summarizes selected improvements from the upstream CHANGELOG. [All releases](changelog.md) includes the complete entries, with fixes and upgrade instructions, from the bundled source revision.

## 2.9.0

[2.9.0, released September 15, 2026](releases/2.9.0.md), keeps State Version **8** and the **33-stage** base graph. New Classic intents use 18 stages through Build and Test. Existing Classic intents keep their recorded graph; use `workshop` for the prior 26-stage route (`--test-strategy standard` restores the Standard test floor).

| Change | Effect |
| --- | --- |
| Classic v1 ceremony | One human approval per stage; advisory reviews, sensors and learnings on, skeleton and summary confirmation off |
| Atomic intent settings | Apply depth, testing, review, change control and three ceremony switches together; invalid values reject the whole command |
| Intent archive | Retire unfinished work without deleting its record, then unarchive when needed |
| Commit provenance | Attribute committed paths to reviewed Units, classify drift and missing evidence, and report the trust basis |
| On-demand autonomy | Grant or revoke Construction autonomy while preserving the first approval, Unit Plan Approval and failure stops |
| Install and models | Separate Bun copy assets; no provider question on Kiro; balanced effort is medium for all three groups |
| Review retries | Use the current ordinal after rejection to avoid false budget-exhaustion stops |

## 2.8.2

[2.8.2, released September 10, 2026](releases/2.8.2.md), fixes summary confirmations, review-findings diagnostics, and Unit lifecycle handling. It includes the native installation and hook fixes in [2.8.1](releases/2.8.1.md). State Version remains 8, with 33 stages.

| Release | Improvement | Effect |
| --- | --- | --- |
| [2.8.2](releases/2.8.2.md) | Summary confirmation tolerates a decorative divider before Assumption Confirmation | Appending the section no longer invalidates an unchanged confirmed summary; substantive edits still require confirmation |
| [2.8.2](releases/2.8.2.md) | Malformed review-findings rows report their cell count and expected columns | Missing or surplus cells can be corrected without guessing which column was omitted; malformed rows still block review completion |
| [2.8.2](releases/2.8.2.md) | Wave stages reject serial Unit start, pause, and resume | The engine preserves state and audit and directs callers to `unit complete --wave`; switching back to unit-major leaves remaining units completable |
| [2.8.1](releases/2.8.1.md) | Fix native setup defaults, same-version updates, and Cursor/Copilot hook routing | Enter accepts setup defaults, current installs pass integrity checks under normal umasks, and native hook adapters receive the right arguments and emit valid Cursor allow responses |

The [2.8.6 entry](releases/2.8.6.md) is retained upstream as superseded development history. No 2.8.6 release was published; 2.8.2 was the intended release at that time. The current bundled target is 2.9.0.

## 2.8.0

[2.8.0, released September 8, 2026](releases/2.8.0.md), consolidates the 2.7.x cycle. Runtime behavior is unchanged from 2.7.2. State Version remains 8, with 33 stages.

| Release | Improvement | Effect |
| --- | --- | --- |
| [2.8.0](releases/2.8.0.md) | New minor baseline for the 2.7.x fixes | Version output and release archives use 2.8.0; existing 2.7.2 records need no migration |
| [2.7.2](releases/2.7.2.md) | Tag-bound release identity and versioned runtime archives | Installers check source identity and SHA-256, with signed attestation verification when a compatible GitHub CLI is available |
| [2.7.1](releases/2.7.1.md) | Fix solo Plan Approval deadlock | The Stop hook's read-only probe no longer invalidates approval, allowing Code Generation to begin |

## Earlier milestones

| Release | What changed |
| --- | --- |
| [2.7.0](releases/2.7.0.md) | Consolidated 2.6.x: 33 stages, Domain and Contract Design, Classic/Express scopes, stronger approval and review checks, focused CodeKB rescans |
| [2.6.124](releases/2.6.124.md) | New state writes use project-relative root and worktree paths, avoiding machine-specific absolute paths in shared records |
| [2.6.120](releases/2.6.120.md) | Focused rescans preserve unrelated CodeKB content and reject concurrent source/store changes |
| [2.6.116](releases/2.6.116.md) | Questions consult previously recorded answers before asking again |
| [2.6.115](releases/2.6.115.md) | Bounded, trust-marked document input for existing vision and requirements documents |
| [2.5.0](releases/2.5.0.md) | Pipeline and mob collaboration modes, recorded contributions and explicit unresolved dissent |
| [2.4.0](releases/2.4.0.md) | Reviews seek defects using tests, acceptance criteria and contracts as evidence |
| [2.3.0](releases/2.3.0.md) | Plugins add stages and contribute outputs, inputs and sensors to existing stages |
| [2.2.0](releases/2.2.0.md) | Adaptive Workflows and `/aidlc compose` propose task-specific stage plans for human approval |
| [2.1.0](releases/2.1.0.md) | Spaces, multiple intents and per-clone audit shards replace the flat workspace layout |
| [2.0.0](releases/2.0.0.md) | Optional LLM review before human approval, plus Kiro IDE support |
| [0.1.0](releases/0.1.0.md) | Initial public release: five phases, 32 stages, expert agents, approval gates and resumable records |

## Upgrading

Run `aidlc update`, then `aidlc config --yes` in each project and `aidlc doctor`. To pin the release, use `install.sh --version 2.9.0` or `install.ps1 -Version 2.9.0`. Manual-copy users replace the complete `runtime/<harness>/` tree from `aidlc-copy-runtime-2.9.0.tar.gz` and use Bun. Migrate scripts from the removed standalone `aidlc-utility.ts change-control` route to `aidlc engine config set change-control <strict|relaxed>`. Unknown `config-change` flags now fail. Pre-2.9 reviews remain `unverifiable` for commit provenance until their next Unit review writes committed evidence. See the [2.9.0 entry](releases/2.9.0.md) and [installation guide](guide/18-install-and-lifecycle.md).

The version badge identifies the bundled documentation, independently of the framework installed in the selected workspace and the AIDLC Guide extension version.
