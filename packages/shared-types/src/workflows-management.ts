/** The tested release installed by every Guide installation/update entry point. */
export const WORKFLOWS_TARGET_VERSION = "2.10.0";

export type WorkflowsManagementState = {
  target: string;
  root: string;
  tools: { id: string; label: string; version: string | null }[];
  projectPin: string | null;
  status: "not-installed" | "current" | "update" | "blocked";
  message: string;
  canInstall: boolean;
  canUpdate: boolean;
  /** True when the update action should run, including writing a missing project pin. */
  engineBumpNeeded: boolean;
  /** True when a recorded tool or pin version differs from the target. A missing pin alone is false. */
  engineVersionDiffers: boolean;
  /** True when a previous update can still be retried. A finished, matching install is false. */
  updateRetryNeeded: boolean;
};

/**
 * Whether this workspace may use the Guide. Anything but `ok` blocks every
 * surface except the update/setup screens, bundled docs, and Doctor/repair.
 * The order of the checks is documented in docs/maintenance/version-gate-design.md.
 */
export type VersionGateStatus =
  | "ok"
  | "not-installed"
  | "unknown"
  | "project-newer"
  | "project-older"
  | "engine-mismatch";

/** The one action the update screen offers for each status. */
export type VersionGateAction =
  | "setup"
  | "doctor"
  | "update-guide"
  | "update-project"
  | "install-engine";

export type VersionGate = {
  status: VersionGateStatus;
  target: string;
  tools: { id: string; label: string; version: string | null }[];
  /** `.aidlc-version`, or null when absent or unreadable. */
  pin: string | null;
  /** The engine this machine resolves for the project; null when none or not native. */
  engine: string | null;
  /** True when a harness tree carries a native-install stamp. */
  native: boolean;
  /** Japanese, human-readable explanation of the status. */
  message: string;
};

export const VERSION_GATE_ACTIONS: Readonly<
  Record<Exclude<VersionGateStatus, "ok">, VersionGateAction>
> = {
  "not-installed": "setup",
  unknown: "doctor",
  "project-newer": "update-guide",
  "project-older": "update-project",
  "engine-mismatch": "install-engine",
};
