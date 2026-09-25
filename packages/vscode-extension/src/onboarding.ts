import {
  advanceOnboardingVersion,
  applyOnboardingEvent,
  initialOnboardingRecord,
  type OnboardingRecord,
  type OnboardingSnapshot,
  type OnboardingView,
  parseOnboardingEvent,
  parseOnboardingRecord,
  unseenNews,
  WHATS_NEW,
} from "@aidlc-guide/shared-types";
import type { ExtensionContext } from "vscode";
import { DOCS_CONVERSATION_KEY } from "./docs-conversation.ts";
import { OFFICIAL_DOCS_LOCALE_KEY } from "./open-official-doc.ts";
import { NOW_DISCLOSURE_KEY, SELECTED_INTENT_KEY, setupStateKey } from "./storage-keys.ts";

/**
 * Per-user onboarding progress. User scope on purpose: the welcome page and
 * the 更新情報 announcement are about this person and this extension, not
 * about one folder, and nothing here is written to a workspace (NFR-1).
 */
export const ONBOARDING_KEY = "aidlc-guide.onboarding.v1";

/** Button of the update notification. */
export const WHATS_NEW_ACTION = "更新情報を見る";

type Storage = Pick<ExtensionContext, "globalState" | "workspaceState">;

export interface OnboardingStart {
  record: OnboardingRecord;
  /** The version changed since the last start, or an existing user is seen for the first time. */
  updated: boolean;
}

const VERSION_RE = /^[0-9A-Za-z.+-]{1,64}$/;

/** The running extension version, or `0.0.0` when the manifest is unreadable. */
export function extensionVersion(context: Pick<ExtensionContext, "extension">): string {
  const version: unknown = context.extension?.packageJSON?.version;
  return typeof version === "string" && VERSION_RE.test(version) ? version : "0.0.0";
}

/**
 * Whether an AIDLC Guide from before onboarding already ran here. Any value
 * such a session writes counts; a first-time user has none of them yet,
 * because this check runs at activation, before setup or the dashboard.
 */
export function detectPriorUse(context: Storage, roots: readonly string[]): boolean {
  const userKeys = [OFFICIAL_DOCS_LOCALE_KEY, DOCS_CONVERSATION_KEY];
  const folderKeys = [NOW_DISCLOSURE_KEY, SELECTED_INTENT_KEY, ...roots.map(setupStateKey)];
  return (
    userKeys.some((key) => context.globalState.get(key) !== undefined) ||
    folderKeys.some((key) => context.workspaceState.get(key) !== undefined)
  );
}

function storedRecord(context: Pick<ExtensionContext, "globalState">): OnboardingRecord | null {
  return parseOnboardingRecord(context.globalState.get(ONBOARDING_KEY));
}

/**
 * Stand-in when nothing is stored at a later point than activation. It does
 * not greet: by then setup has run, so a missing record is a storage problem,
 * not a new user.
 */
function quietRecord(version: string): OnboardingRecord {
  return initialOnboardingRecord({ version, priorUse: true, entries: WHATS_NEW });
}

/** Run once per activation: create the record, or record the running version. */
export async function startOnboarding(
  context: Storage,
  version: string,
  roots: readonly string[],
): Promise<OnboardingStart> {
  const stored = storedRecord(context);
  if (stored === null) {
    const priorUse = detectPriorUse(context, roots);
    const record = initialOnboardingRecord({ version, priorUse, entries: WHATS_NEW });
    await context.globalState.update(ONBOARDING_KEY, record);
    return { record, updated: priorUse };
  }
  const { record, previousVersion } = advanceOnboardingVersion(stored, version);
  if (previousVersion !== null) await context.globalState.update(ONBOARDING_KEY, record);
  return { record, updated: previousVersion !== null };
}

/** What a dashboard panel receives on `ready`. Read-only: never writes storage. */
export function onboardingSnapshot(
  context: Pick<ExtensionContext, "globalState">,
  version: string,
  open?: OnboardingView,
): OnboardingSnapshot {
  const record = storedRecord(context) ?? quietRecord(version);
  return open === undefined ? { version, record } : { version, record, open };
}

/**
 * Apply one webview event after validating it. Returns `false` for an
 * invalid event. Writes only when the record actually changes.
 */
export async function recordOnboardingEvent(
  context: Pick<ExtensionContext, "globalState">,
  version: string,
  message: unknown,
): Promise<boolean> {
  const event = parseOnboardingEvent(message);
  if (event === null) return false;
  const current = storedRecord(context) ?? quietRecord(version);
  const next = applyOnboardingEvent(current, event, WHATS_NEW);
  if (next !== current) await context.globalState.update(ONBOARDING_KEY, next);
  return true;
}

/** The notification after an update, or `null` when there is nothing new to point at. */
export function updateNotice(start: OnboardingStart, version: string): string | null {
  if (!start.updated) return null;
  const fresh = unseenNews(WHATS_NEW, start.record);
  const first = fresh[0];
  if (first === undefined) return null;
  const rest = fresh.length > 1 ? `（ほか ${fresh.length - 1} 件）` : "";
  return `AIDLC Guide を ${version} に更新しました。新機能：${first.title}${rest}`;
}
