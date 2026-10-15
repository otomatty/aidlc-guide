/**
 * The 「プラグイン」 page and the extension talk over webview messages, not api-core routes:
 * installing runs the native `aidlc` CLI on the extension host, which the browser cannot reach.
 * docs/maintenance/plugins-page-design.md, 「通信」.
 */

/** Where a bundled plugin stands in the open project. */
export type PluginStatus =
  | "not-installed"
  | "enabled"
  | "disabled"
  | "update-available"
  | "attention";

export interface PluginInstallState {
  name: string;
  status: PluginStatus;
  /** The version the project's install record pins, when there is one. */
  installedVersion: string | null;
  /** Why the plugin needs attention, in words for the reader. */
  detail?: string;
}

export type PluginAction = "install" | "enable" | "disable" | "update";

/** The existing extension screens a prerequisite can send the reader to. */
export type PluginPrerequisiteAction =
  | "open-workflows-setup"
  | "open-workflows-install"
  | "open-workflows-update";

export interface PluginPrerequisite {
  id:
    | "trusted"
    | "version-gate"
    | "claude"
    | "native"
    | "idle-workflows"
    | "idle-operation"
    | "atlassian-mcp"
    | "opus";
  /** `required` blocks every action; the others only explain. */
  level: "required" | "recommended" | "info";
  /** `null` when the extension cannot tell (the model Claude Code runs). */
  met: boolean | null;
  label: string;
  detail: string;
  action?: PluginPrerequisiteAction;
}

export interface PluginOperation {
  action: PluginAction;
  name: string;
}

export interface PluginsState {
  plugins: PluginInstallState[];
  prerequisites: PluginPrerequisite[];
  /** Every required prerequisite is met and nothing is running. */
  canAct: boolean;
  /** The operation running now, if any. */
  running: PluginOperation | null;
}

export interface PluginProgress extends PluginOperation {
  step: number;
  total: number;
  text: string;
}

export type PluginResult =
  | (PluginOperation & {
      outcome: "succeeded";
      /** Files git sees changed by the operation, at most `CHANGED_FILES_SHOWN`. */
      changedFiles: string[];
      moreFiles: number;
      /** `null` outside a git repository. */
      commitMessage: string | null;
    })
  | (PluginOperation & { outcome: "failed"; message: string; doctor: boolean })
  | (PluginOperation & { outcome: "cancelled" });

export const CHANGED_FILES_SHOWN = 30;

/** Extension → page. */
export type PluginsHostMessage =
  | { type: "plugins-state"; state: PluginsState }
  | { type: "plugins-progress"; progress: PluginProgress }
  | { type: "plugins-result"; result: PluginResult };

/** Page → extension. */
export type PluginsPanelMessage =
  | { type: "plugins-get" }
  | { type: "plugins-action"; action: PluginAction; name: string }
  | { type: "plugins-cancel" }
  | { type: "plugins-copy-start"; name: string };

const ACTIONS: readonly PluginAction[] = ["install", "enable", "disable", "update"];
const PLUGIN_NAME = /^[a-z][a-z0-9-]{0,63}$/;

/** Read a message from the page; anything else is `null`. The host never trusts its shape. */
export function parsePluginsPanelMessage(raw: unknown): PluginsPanelMessage | null {
  if (raw === null || typeof raw !== "object") return null;
  const message = raw as Record<string, unknown>;
  switch (message.type) {
    case "plugins-get":
      return { type: "plugins-get" };
    case "plugins-cancel":
      return { type: "plugins-cancel" };
    case "plugins-action":
      return ACTIONS.includes(message.action as PluginAction) &&
        typeof message.name === "string" &&
        PLUGIN_NAME.test(message.name)
        ? { type: "plugins-action", action: message.action as PluginAction, name: message.name }
        : null;
    case "plugins-copy-start":
      return typeof message.name === "string" && PLUGIN_NAME.test(message.name)
        ? { type: "plugins-copy-start", name: message.name }
        : null;
    default:
      return null;
  }
}
