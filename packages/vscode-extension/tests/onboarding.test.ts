import { type OnboardingRecord, WHATS_NEW } from "@aidlc-guide/shared-types";
import { describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { DOCS_CONVERSATION_KEY } from "../src/docs-conversation.ts";
import {
  detectPriorUse,
  extensionVersion,
  ONBOARDING_KEY,
  onboardingSnapshot,
  recordOnboardingEvent,
  startOnboarding,
  updateNotice,
} from "../src/onboarding.ts";
import { OFFICIAL_DOCS_LOCALE_KEY } from "../src/open-official-doc.ts";
import { NOW_DISCLOSURE_KEY, SELECTED_INTENT_KEY, setupStateKey } from "../src/storage-keys.ts";

function memento(initial: Record<string, unknown> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    get: vi.fn((key: string) => values.get(key)),
    update: vi.fn(async (key: string, value: unknown) => {
      values.set(key, value);
    }),
  };
}

function storage(global: Record<string, unknown> = {}, workspace: Record<string, unknown> = {}) {
  const globalState = memento(global);
  const workspaceState = memento(workspace);
  const context = { globalState, workspaceState } as unknown as ExtensionContext;
  return { context, globalState, workspaceState };
}

const ALL_IDS = WHATS_NEW.map((entry) => entry.id);
const NEWEST = WHATS_NEW[0]?.date;

describe("detectPriorUse", () => {
  it("finds nothing in empty storage", () => {
    expect(detectPriorUse(storage().context, ["project"])).toBe(false);
  });

  it.each([OFFICIAL_DOCS_LOCALE_KEY, DOCS_CONVERSATION_KEY])(
    "treats the user-level key %s as an earlier session",
    (key) => {
      expect(detectPriorUse(storage({ [key]: "ja" }).context, [])).toBe(true);
    },
  );

  it.each([NOW_DISCLOSURE_KEY, SELECTED_INTENT_KEY])(
    "treats the workspace key %s as an earlier session",
    (key) => {
      expect(detectPriorUse(storage({}, { [key]: false }).context, [])).toBe(true);
    },
  );

  it("treats a stored setup for an open folder as an earlier session", () => {
    const { context } = storage({}, { [setupStateKey("project")]: { completed: true } });
    expect(detectPriorUse(context, ["other", "project"])).toBe(true);
    expect(detectPriorUse(context, ["other"])).toBe(false);
  });
});

describe("startOnboarding", () => {
  it("stores a greeting record for a first-time user without announcing an update", async () => {
    const { context, globalState } = storage();
    const start = await startOnboarding(context, "0.35.0", ["project"]);
    expect(start.updated).toBe(false);
    expect(start.record).toMatchObject({ version: "0.35.0", welcome: "pending" });
    expect(start.record.seenNews).toEqual(ALL_IDS);
    expect(globalState.update).toHaveBeenCalledExactlyOnceWith(ONBOARDING_KEY, start.record);
  });

  it("announces the newest changes to an existing user seen for the first time", async () => {
    const { context, globalState } = storage({}, { [setupStateKey("project")]: {} });
    const start = await startOnboarding(context, "0.35.0", ["project"]);
    expect(start.updated).toBe(true);
    expect(start.record.welcome).toBe("done");
    const unseen = WHATS_NEW.filter((entry) => !start.record.seenNews.includes(entry.id));
    expect(unseen.length).toBeGreaterThan(0);
    expect(unseen.every((entry) => entry.date === NEWEST)).toBe(true);
    expect(globalState.values.get(ONBOARDING_KEY)).toEqual(start.record);
  });

  it("does not write when the same version starts again", async () => {
    const stored: OnboardingRecord = {
      version: "0.35.0",
      welcome: "done",
      seenNews: ["onboarding"],
      dismissedTips: [],
    };
    const { context, globalState } = storage({ [ONBOARDING_KEY]: stored });
    const start = await startOnboarding(context, "0.35.0", []);
    expect(start).toEqual({ record: stored, updated: false });
    expect(globalState.update).not.toHaveBeenCalled();
  });

  it("records the new version after an update and keeps what was seen", async () => {
    const stored: OnboardingRecord = {
      version: "0.35.0",
      welcome: "deferred",
      seenNews: ["onboarding"],
      dismissedTips: ["area:stage"],
    };
    const { context, globalState } = storage({ [ONBOARDING_KEY]: stored });
    const start = await startOnboarding(context, "0.36.0", []);
    expect(start.updated).toBe(true);
    expect(start.record).toEqual({ ...stored, version: "0.36.0" });
    expect(globalState.update).toHaveBeenCalledExactlyOnceWith(ONBOARDING_KEY, start.record);
  });

  it("rebuilds a corrupt record instead of failing", async () => {
    const { context } = storage({ [ONBOARDING_KEY]: { version: 3 } });
    const start = await startOnboarding(context, "0.35.0", []);
    expect(start.record.welcome).toBe("pending");
  });
});

describe("onboardingSnapshot", () => {
  it("sends the stored record, the running version, and a requested view", () => {
    const stored: OnboardingRecord = {
      version: "0.35.0",
      welcome: "done",
      seenNews: [],
      dismissedTips: [],
    };
    const { context, globalState } = storage({ [ONBOARDING_KEY]: stored });
    expect(onboardingSnapshot(context, "0.35.0")).toEqual({ version: "0.35.0", record: stored });
    expect(onboardingSnapshot(context, "0.35.0", "whats-new")).toEqual({
      version: "0.35.0",
      record: stored,
      open: "whats-new",
    });
    expect(globalState.update).not.toHaveBeenCalled();
  });

  it("falls back to a quiet record without writing when storage is empty", () => {
    const { context, globalState } = storage();
    const snapshot = onboardingSnapshot(context, "0.35.0");
    expect(snapshot.record.welcome).toBe("done");
    expect(globalState.update).not.toHaveBeenCalled();
  });
});

describe("recordOnboardingEvent", () => {
  const stored: OnboardingRecord = {
    version: "0.35.0",
    welcome: "pending",
    seenNews: [],
    dismissedTips: [],
  };

  it("validates, applies and stores an event", async () => {
    const { context, globalState } = storage({ [ONBOARDING_KEY]: stored });
    await expect(
      recordOnboardingEvent(context, "0.35.0", { kind: "news-seen", ids: ["onboarding", "zzz"] }),
    ).resolves.toBe(true);
    expect(globalState.values.get(ONBOARDING_KEY)).toEqual({ ...stored, seenNews: ["onboarding"] });
    await recordOnboardingEvent(context, "0.35.0", { kind: "welcome", status: "deferred" });
    expect(globalState.values.get(ONBOARDING_KEY)).toMatchObject({ welcome: "deferred" });
  });

  it.each([null, { kind: "welcome", status: "pending" }, { kind: "tip-dismissed", id: "../x" }])(
    "ignores an invalid event: %j",
    async (event) => {
      const { context, globalState } = storage({ [ONBOARDING_KEY]: stored });
      await expect(recordOnboardingEvent(context, "0.35.0", event)).resolves.toBe(false);
      expect(globalState.update).not.toHaveBeenCalled();
    },
  );

  it("skips the write when the event changes nothing", async () => {
    const { context, globalState } = storage({ [ONBOARDING_KEY]: stored });
    await recordOnboardingEvent(context, "0.35.0", { kind: "welcome", status: "pending" });
    await recordOnboardingEvent(context, "0.35.0", { kind: "tip-dismissed", id: "area:nowhere" });
    expect(globalState.update).not.toHaveBeenCalled();
  });
});

describe("updateNotice", () => {
  const record: OnboardingRecord = {
    version: "0.35.0",
    welcome: "done",
    seenNews: ALL_IDS.slice(2),
    dismissedTips: [],
  };

  it("names the newest change and counts the rest after an update", () => {
    const first = WHATS_NEW[0];
    expect(updateNotice({ record, updated: true }, "0.35.0")).toBe(
      `AIDLC Guide を 0.35.0 に更新しました。新機能：${first?.title}（ほか 1 件）`,
    );
  });

  it("omits the count when one change is new", () => {
    const one = { ...record, seenNews: ALL_IDS.slice(1) };
    expect(updateNotice({ record: one, updated: true }, "0.35.0")).toBe(
      `AIDLC Guide を 0.35.0 に更新しました。新機能：${WHATS_NEW[0]?.title}`,
    );
  });

  it("stays silent without an update or without anything new", () => {
    expect(updateNotice({ record, updated: false }, "0.35.0")).toBeNull();
    expect(
      updateNotice({ record: { ...record, seenNews: ALL_IDS }, updated: true }, "0.35.0"),
    ).toBeNull();
  });
});

describe("extensionVersion", () => {
  it("reads the manifest version and falls back when it is missing or unsafe", () => {
    const withVersion = (version: unknown) =>
      ({ extension: { packageJSON: { version } } }) as unknown as ExtensionContext;
    expect(extensionVersion(withVersion("0.35.0"))).toBe("0.35.0");
    expect(extensionVersion(withVersion("0.35.0 <b>"))).toBe("0.0.0");
    expect(extensionVersion(withVersion(35))).toBe("0.0.0");
    expect(extensionVersion({} as ExtensionContext)).toBe("0.0.0");
  });
});
