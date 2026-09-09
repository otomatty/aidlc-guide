# aidlc-workflows release highlights

This guide summarizes selected improvements from the upstream CHANGELOG. [All releases](changelog.md) includes the complete entries, with fixes and upgrade instructions, from the bundled source revision.

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

Use `install.sh --version 2.8.0`, `install.ps1 -Version 2.8.0`, or `runtime/<harness>/` from `aidlc-runtime-2.8.0.tar.gz`. See the [setup guide](guide/01-getting-started.md) and [2.8.0 entry](releases/2.8.0.md). Upgrades from versions earlier than 2.7.2 must also follow every intervening Upgrade, Breaking and migration note.

The version badge identifies the bundled documentation, independently of the framework installed in the selected workspace and the AIDLC Guide extension version.
