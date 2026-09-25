/**
 * Onboarding contract: the welcome page, the 更新情報 (what's new) sheet and
 * the in-place tips.
 *
 * The extension host stores one {@link OnboardingRecord} per user in
 * `globalState`, validates every event the webview sends, and announces
 * updates. The dashboard renders from the same record and applies the same
 * events optimistically. Both sides call these pure functions, so the stored
 * value and what the user sees cannot drift apart.
 *
 * Nothing here touches the workspace: onboarding state is per user and lives
 * only in the editor's extension storage (NFR-1).
 */

/** Screens that can show one in-place tip. */
export const ONBOARDING_AREAS = [
  "home",
  "stage",
  "docs",
  "customization",
  "effectiveness",
] as const;
export type OnboardingArea = (typeof ONBOARDING_AREAS)[number];

/** Where a what's-new action or a welcome-page button lands. */
export const ONBOARDING_TARGETS = [
  "home",
  "welcome",
  "tour",
  "docs",
  "customization",
  "effectiveness",
  "settings",
] as const;
export type OnboardingTarget = (typeof ONBOARDING_TARGETS)[number];

/** One user-facing change in the 更新情報 list. */
export interface WhatsNewEntry {
  /**
   * Stable kebab-case id. Stored seen-sets hold it, so a shipped id must never
   * be renamed: that would announce the change again to every user.
   */
  id: string;
  /** Merge date, `YYYY-MM-DD`. The list is ordered newest first. */
  date: string;
  title: string;
  body: string;
  /** The 「開いてみる」 button of this entry. */
  action?: { label: string; target: OnboardingTarget };
  /** A 新機能 tip shown once in that area until the user dismisses it. */
  spotlight?: { area: OnboardingArea; text: string };
}

/**
 * `pending` until the welcome page has been shown automatically once.
 * `deferred` means the user chose 「あとで読む」, which arms the home tip that
 * points at the menu.
 */
export type WelcomeStatus = "pending" | "done" | "deferred";

export interface OnboardingRecord {
  /** Extension version that last started. A different version is an update. */
  version: string;
  welcome: WelcomeStatus;
  /** What's-new ids already presented. */
  seenNews: string[];
  /** Area tip and spotlight ids the user closed. */
  dismissedTips: string[];
}

/** Webview → host. Validated by {@link parseOnboardingEvent} at the boundary. */
export type OnboardingEvent =
  | { kind: "welcome"; status: "done" | "deferred" }
  | { kind: "news-seen"; ids: string[] }
  | { kind: "tip-dismissed"; id: string }
  | { kind: "tips-reset" };

/** A view a command or notification asks the dashboard to open. */
export type OnboardingView = "welcome" | "whats-new";

/** Host → webview on `ready`: `{ type: "onboarding", state: OnboardingSnapshot }`. */
export interface OnboardingSnapshot {
  version: string;
  record: OnboardingRecord;
  /** One-shot request, honoured once by the panel that receives it. */
  open?: OnboardingView;
}

const ID_RE = /^[a-z0-9][a-z0-9:-]{0,79}$/;
const VERSION_RE = /^[0-9A-Za-z.+-]{1,64}$/;
const MAX_STORED_IDS = 500;
const MAX_EVENT_IDS = 100;
const WELCOME_STATUSES: readonly WelcomeStatus[] = ["pending", "done", "deferred"];

export function areaTipId(area: OnboardingArea): string {
  return `area:${area}`;
}

export function spotlightTipId(entryId: string): string {
  return `news:${entryId}`;
}

const AREA_TIP_IDS = ONBOARDING_AREAS.map(areaTipId);

/** Every tip id an event may name; anything else is dropped. */
export function knownTipIds(entries: readonly WhatsNewEntry[]): Set<string> {
  return new Set([
    ...AREA_TIP_IDS,
    ...entries.flatMap((entry) =>
      entry.spotlight === undefined ? [] : [spotlightTipId(entry.id)],
    ),
  ]);
}

function spotlightIds(entries: readonly WhatsNewEntry[]): string[] {
  return entries.flatMap((entry) =>
    entry.spotlight === undefined ? [] : [spotlightTipId(entry.id)],
  );
}

/**
 * The record for someone this version has never seen.
 *
 * A first-time user (`priorUse: false`) is greeted by the welcome page, and
 * every shipped change is already "known" to them, so nothing is announced as
 * new. An existing user who updates from a version without onboarding is not
 * greeted; they get the newest batch of changes (every entry sharing the
 * newest date) as the update announcement, and no area tips for screens they
 * already use.
 */
export function initialOnboardingRecord({
  version,
  priorUse,
  entries,
}: {
  version: string;
  priorUse: boolean;
  entries: readonly WhatsNewEntry[];
}): OnboardingRecord {
  if (!priorUse)
    return {
      version,
      welcome: "pending",
      seenNews: entries.map((entry) => entry.id),
      dismissedTips: spotlightIds(entries),
    };
  const newest = entries.reduce<string>(
    (latest, entry) => (entry.date > latest ? entry.date : latest),
    "",
  );
  const known = entries.filter((entry) => entry.date !== newest);
  return {
    version,
    welcome: "done",
    seenNews: known.map((entry) => entry.id),
    dismissedTips: [...AREA_TIP_IDS, ...spotlightIds(known)],
  };
}

/** Record the running version. `previousVersion` is non-null after an update. */
export function advanceOnboardingVersion(
  record: OnboardingRecord,
  version: string,
): { record: OnboardingRecord; previousVersion: string | null } {
  if (record.version === version) return { record, previousVersion: null };
  return { record: { ...record, version }, previousVersion: record.version };
}

/**
 * Apply one event. Returns the same object when nothing changes, so callers
 * can skip a storage write. Unknown ids are ignored rather than stored.
 */
export function applyOnboardingEvent(
  record: OnboardingRecord,
  event: OnboardingEvent,
  entries: readonly WhatsNewEntry[],
): OnboardingRecord {
  switch (event.kind) {
    case "welcome":
      return record.welcome === event.status ? record : { ...record, welcome: event.status };
    case "news-seen": {
      const known = new Set(entries.map((entry) => entry.id));
      const seen = new Set(record.seenNews);
      const added = [...new Set(event.ids)].filter((id) => known.has(id) && !seen.has(id));
      return added.length === 0 ? record : { ...record, seenNews: [...record.seenNews, ...added] };
    }
    case "tip-dismissed":
      return !knownTipIds(entries).has(event.id) || record.dismissedTips.includes(event.id)
        ? record
        : { ...record, dismissedTips: [...record.dismissedTips, event.id] };
    case "tips-reset": {
      const kept = record.dismissedTips.filter((id) => !id.startsWith("area:"));
      return kept.length === record.dismissedTips.length
        ? record
        : { ...record, dismissedTips: kept };
    }
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

/** Changes the user has not been shown yet, in list order. */
export function unseenNews(
  entries: readonly WhatsNewEntry[],
  record: OnboardingRecord,
): WhatsNewEntry[] {
  const seen = new Set(record.seenNews);
  return entries.filter((entry) => !seen.has(entry.id));
}

/** The newest change whose spotlight belongs to `area` and is still open. */
export function activeSpotlight(
  entries: readonly WhatsNewEntry[],
  record: OnboardingRecord,
  area: OnboardingArea,
): WhatsNewEntry | null {
  return (
    entries.find(
      (entry) =>
        entry.spotlight?.area === area && !record.dismissedTips.includes(spotlightTipId(entry.id)),
    ) ?? null
  );
}

/**
 * Whether the area's own tip is open. The home tip only reminds a user who
 * put the welcome off where to find it again; the welcome page itself covers
 * the home screen for everyone else.
 */
export function areaTipVisible(record: OnboardingRecord, area: OnboardingArea): boolean {
  if (record.dismissedTips.includes(areaTipId(area))) return false;
  return area === "home" ? record.welcome === "deferred" : true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID_RE.test(value);
}

function idList(value: unknown, limit: number): string[] | null {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter(isId))].slice(0, limit);
}

/** Read a stored record. Malformed storage yields `null`, never a throw. */
export function parseOnboardingRecord(value: unknown): OnboardingRecord | null {
  if (!isRecord(value)) return null;
  const { version, welcome } = value;
  if (typeof version !== "string" || !VERSION_RE.test(version)) return null;
  if (!WELCOME_STATUSES.includes(welcome as WelcomeStatus)) return null;
  const seenNews = idList(value.seenNews, MAX_STORED_IDS);
  const dismissedTips = idList(value.dismissedTips, MAX_STORED_IDS);
  if (seenNews === null || dismissedTips === null) return null;
  return { version, welcome: welcome as WelcomeStatus, seenNews, dismissedTips };
}

/** The single boundary check for webview → host events. */
export function parseOnboardingEvent(value: unknown): OnboardingEvent | null {
  if (!isRecord(value)) return null;
  switch (value.kind) {
    case "welcome":
      return value.status === "done" || value.status === "deferred"
        ? { kind: "welcome", status: value.status }
        : null;
    case "news-seen": {
      const { ids } = value;
      if (!Array.isArray(ids) || ids.length > MAX_EVENT_IDS || !ids.every(isId)) return null;
      return { kind: "news-seen", ids: [...ids] };
    }
    case "tip-dismissed":
      return isId(value.id) ? { kind: "tip-dismissed", id: value.id } : null;
    case "tips-reset":
      return { kind: "tips-reset" };
    default:
      return null;
  }
}

/** Validate the host snapshot the webview receives. */
export function parseOnboardingSnapshot(value: unknown): OnboardingSnapshot | null {
  if (!isRecord(value)) return null;
  const { version, open } = value;
  if (typeof version !== "string" || !VERSION_RE.test(version)) return null;
  const record = parseOnboardingRecord(value.record);
  if (record === null) return null;
  if (open === undefined) return { version, record };
  return open === "welcome" || open === "whats-new" ? { version, record, open } : null;
}
