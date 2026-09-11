# Doctor output fixtures

The `ok`, `warning`, and `failed` fixtures pin the verbose, color-free `humanReport` format
from `aidlc-doctor.ts` in AI-DLC 2.8.0 and 2.8.1. They are constructed examples
using labels and remedies from `aidlc-utility.ts` and `aidlc-doctor-bundle.ts`;
they are not full reports collected from a user's computer.

`v2.8.0-source-empty-project.txt` is a complete report captured on Windows on
2026-09-11 by running the bundled 2.8.0 source doctor with
`--verbose --no-color` against an empty temporary project, with non-interactive output. The user
home path was replaced with `C:\Users\example`. It includes 48 checks and exits
with code 1, reporting three problems and one warning.

The `state-audit-drift` finding has internal severity `error`, but the human
renderer emits it as `warn` and includes it in the warning footer. JSON report
counts omit that extra finding. The parser must preserve the human result.

Before adding a supported version, compare its renderer with these fixtures,
including section order, verdict padding, fixes, findings, and footer counts.
