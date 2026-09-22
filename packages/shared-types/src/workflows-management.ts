/** The tested release installed by every Guide installation/update entry point. */
export const WORKFLOWS_TARGET_VERSION = "2.9.0";

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
};
