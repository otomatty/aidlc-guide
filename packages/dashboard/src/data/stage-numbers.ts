/**
 * Stage numbers from `.claude/tools/data/stage-graph.json`.
 * Keep in sync when the aidlc stage graph changes.
 */
export const STAGE_NUMBERS: Readonly<Record<string, string>> = {
  "workspace-scaffold": "0.1",
  "workspace-detection": "0.2",
  "state-init": "0.3",
  "intent-capture": "1.1",
  "market-research": "1.2",
  feasibility: "1.3",
  "scope-definition": "1.4",
  "team-formation": "1.5",
  "rough-mockups": "1.6",
  "approval-handoff": "1.7",
  "reverse-engineering": "2.1",
  "practices-discovery": "2.2",
  "requirements-analysis": "2.3",
  "user-stories": "2.4",
  "refined-mockups": "2.5",
  "application-design": "2.6",
  "units-generation": "2.7",
  "delivery-planning": "2.8",
  "functional-design": "3.1",
  "nfr-requirements": "3.2",
  "nfr-design": "3.3",
  "infrastructure-design": "3.4",
  "code-generation": "3.5",
  "build-and-test": "3.6",
  "ci-pipeline": "3.7",
  "deployment-pipeline": "4.1",
  "environment-provisioning": "4.2",
  "deployment-execution": "4.3",
  "observability-setup": "4.4",
  "incident-response": "4.5",
  "performance-validation": "4.6",
  "feedback-optimization": "4.7",
};

/** `1.1 intent-capture` — falls back to the slug alone when unknown. */
export function formatStageLabel(slug: string): string {
  const number = STAGE_NUMBERS[slug];
  return number === undefined ? slug : `${number} ${slug}`;
}
