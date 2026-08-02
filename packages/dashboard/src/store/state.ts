import type {
  DocsShellDeepLink,
  IntentList,
  Matrix,
  NextStep,
  OfficialDocsLocale,
  ProjectLink,
  StageDoc,
  TimingsPayload,
  WorkflowModel,
} from "@aidlc-guide/shared-types";

/**
 * UI-only types. Everything that crosses the wire is imported from
 * shared-types and never re-declared here (BR-UI-1 / domain-entities.md).
 */

/** Per-area display state — the five states of refined-mockups Q2. */
export type ViewState<T> =
  | { kind: "loading" }
  | { kind: "empty"; hint: string }
  | { kind: "error"; detail: string }
  | { kind: "partial"; value: T; notes: string[] }
  | { kind: "success"; value: T };

export type Selection =
  | { kind: "stage"; slug: string }
  | { kind: "cell"; unit: string; stage: string }
  | null;

export type AgentOpen = { id: string; returnTo: Selection };

export type Theme = "light" | "dark";

export type { WorkflowPayload } from "@aidlc-guide/shared-types";

export interface AppState {
  workflow: ViewState<WorkflowModel>;
  nextStep: ViewState<NextStep>;
  matrix: ViewState<Matrix>;
  /**
   * Derived from the audit log, off the first-paint path: it arrives after
   * the three startup slices and refreshes on every change push.
   */
  timings: ViewState<TimingsPayload>;
  /** Enumeration only — this unit never switches the active intent (US-15). */
  intents: ViewState<IntentList>;
  selected: Selection;
  /** In-webview route: usage guides panel (mutually exclusive with `selected`). */
  guidesOpen: boolean;
  /** In-webview route: official docs shell (mutually exclusive with other routes). */
  docsShellOpen: boolean;
  /**
   * One-shot deep-link target applied when the shell opens (FR-B2-3 / FR-B3-4).
   * When non-null, `locale` is required. Cleared after DocsShell consumes it.
   */
  docsShellDeepLink: DocsShellDeepLink | null;
  /**
   * Last Official Docs locale (LocaleControl + deep-link inject).
   * Used when building `open-official-doc` payloads; default `"en"`.
   */
  officialDocsLocale: OfficialDocsLocale;
  /** In-webview route: agent detail panel (mutually exclusive with `selected`). */
  agentOpen: AgentOpen | null;
  /** slug → explanation. Fetched on selection and memoised for the session. */
  stageDoc: Record<string, ViewState<StageDoc>>;
  projectLinks: ViewState<ProjectLink[]>;
  /**
   * From `aidlc-guide.config.json` — base URL + per-stage overrides for
   * 「docs を開く」. Empty until `/api/docs-settings` lands.
   */
  docsBaseUrl: string | null;
  stageDocs: Readonly<Record<string, string>>;
  live: LiveSlice;
  theme: Theme;
  /**
   * `--host` is running: the server refuses writes for every client (US-11).
   * Fixed for the life of the server process — `readonly` because there is no
   * toggle and adding one would be a change to the exposure model (S-MM-6).
   */
  readonly hostMode: boolean;
}

/** Connection health. The sole input of `liveStatusView` (mob-mode M3). */
export interface LiveSlice {
  connected: boolean;
  degraded: boolean;
  reason?: string;
  /**
   * `true` once a socket has opened at least once. Without it "not connected"
   * cannot tell first connect from a drop, and the UI would open on
   * 「切断・再接続中…」 before anything had ever been connected.
   */
  everConnected: boolean;
  /**
   * ISO time of the most recent `change` push **actually received** — never a
   * connect time and never a guess, so 「最終更新」 cannot overstate liveness
   * (R-MM-3). Absent until the first change arrives.
   */
  lastChangeAt?: string;
}

export const initialState: AppState = {
  workflow: { kind: "loading" },
  nextStep: { kind: "loading" },
  matrix: { kind: "loading" },
  timings: { kind: "loading" },
  intents: { kind: "loading" },
  selected: null,
  guidesOpen: false,
  docsShellOpen: false,
  docsShellDeepLink: null,
  officialDocsLocale: "en",
  agentOpen: null,
  stageDoc: {},
  projectLinks: { kind: "loading" },
  docsBaseUrl: null,
  stageDocs: {},
  live: { connected: false, degraded: false, everConnected: false },
  theme: "light",
  hostMode: false,
};

/** Convenience for components that only care about "is there a value". */
export function viewValue<T>(state: ViewState<T>): T | null {
  return state.kind === "success" || state.kind === "partial" ? state.value : null;
}
