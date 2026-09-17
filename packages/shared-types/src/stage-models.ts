/** Configured models are predictions, never observations of a running session. */
export interface AgentModelSetting {
  agent: string;
  source: "session" | "agent" | "unavailable";
  model: string | null;
  /** Project-local alias mapping; user settings / launch overrides may differ. */
  projectModel: string | null;
  effort: string | null;
}

export interface StageModelSettings {
  slug: string;
  mode: string;
  lead: AgentModelSetting;
  supports: AgentModelSetting[];
  /** Declared reviewer, which review policy can disable. */
  reviewer: AgentModelSetting | null;
}

export interface StageModelsPayload {
  harnesses: {
    id: "claude" | "cursor";
    label: string;
    stages: StageModelSettings[];
  }[];
  /**
   * Selected intent's cumulative Claude usage, not the current model or agent attribution.
   * `null` means usage was withheld (tracking disabled or settings unreadable), not that no record exists.
   */
  observed: Record<string, string[]> | null;
}
