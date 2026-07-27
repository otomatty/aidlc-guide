# AI-DLC Audit Log

## Workflow Start
<!-- The Workflow field below is fixture-only, to exercise field extraction
     (audit.test.ts). A real WORKFLOW_STARTED record never carries it — only
     the synthetic STAGE_STARTED/STAGE_COMPLETED pair a `--single` stage run
     emits does (see timing/derive.ts). Placed here, not on the STAGE_STARTED
     below, so it stays inert: it fires before any run is open, so derive.ts
     skipping it changes nothing the timing-read.test.ts assertions check. -->
**Timestamp**: 2026-07-20T10:00:00Z
**Event**: WORKFLOW_STARTED
**Scope**: feature
**Workflow**: single-stage:demo-stage

---

## Stage Completion
**Timestamp**: 2026-07-20T12:00:00Z
**Event**: STAGE_COMPLETED
**Stage**: intent-capture
