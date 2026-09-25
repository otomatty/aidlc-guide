import { describe, expect, it } from "vitest";
import {
  activeSpotlight,
  advanceOnboardingVersion,
  applyOnboardingEvent,
  areaTipId,
  areaTipVisible,
  initialOnboardingRecord,
  knownTipIds,
  ONBOARDING_AREAS,
  type OnboardingRecord,
  parseOnboardingEvent,
  parseOnboardingRecord,
  parseOnboardingSnapshot,
  spotlightTipId,
  unseenNews,
  type WhatsNewEntry,
} from "../src/index.ts";

/** Newest first, the same order the shipped list uses. */
const ENTRIES: WhatsNewEntry[] = [
  {
    id: "latest-a",
    date: "2026-09-25",
    title: "A",
    body: "a",
    spotlight: { area: "home", text: "home spotlight" },
  },
  {
    id: "latest-b",
    date: "2026-09-25",
    title: "B",
    body: "b",
    spotlight: { area: "docs", text: "docs spotlight" },
  },
  {
    id: "older",
    date: "2026-09-20",
    title: "C",
    body: "c",
    spotlight: { area: "docs", text: "older docs spotlight" },
  },
  { id: "oldest", date: "2026-09-01", title: "D", body: "d" },
];

const AREA_TIPS = ONBOARDING_AREAS.map(areaTipId);

function record(overrides: Partial<OnboardingRecord> = {}): OnboardingRecord {
  return { version: "1.0.0", welcome: "done", seenNews: [], dismissedTips: [], ...overrides };
}

describe("initialOnboardingRecord", () => {
  it("greets a first-time user and treats every shipped change as already known", () => {
    const initial = initialOnboardingRecord({
      version: "0.35.0",
      priorUse: false,
      entries: ENTRIES,
    });
    expect(initial).toEqual({
      version: "0.35.0",
      welcome: "pending",
      seenNews: ["latest-a", "latest-b", "older", "oldest"],
      dismissedTips: ["news:latest-a", "news:latest-b", "news:older"],
    });
    // A new user still gets every area tip on the first visit.
    for (const tip of AREA_TIPS) expect(initial.dismissedTips).not.toContain(tip);
  });

  it("does not greet an existing user, and announces only the newest batch", () => {
    const initial = initialOnboardingRecord({
      version: "0.35.0",
      priorUse: true,
      entries: ENTRIES,
    });
    expect(initial.welcome).toBe("done");
    expect(initial.seenNews).toEqual(["older", "oldest"]);
    // Area tips explain screens an existing user already knows.
    expect(initial.dismissedTips).toEqual([...AREA_TIPS, "news:older"]);
    expect(unseenNews(ENTRIES, initial).map((entry) => entry.id)).toEqual([
      "latest-a",
      "latest-b",
    ]);
  });

  it("finds the newest batch by date, not by list position", () => {
    const shuffled = [ENTRIES[3], ENTRIES[0], ENTRIES[2], ENTRIES[1]] as WhatsNewEntry[];
    const initial = initialOnboardingRecord({
      version: "0.35.0",
      priorUse: true,
      entries: shuffled,
    });
    expect(initial.seenNews.sort()).toEqual(["older", "oldest"]);
  });

  it("handles an empty change list for both kinds of user", () => {
    expect(initialOnboardingRecord({ version: "1.0.0", priorUse: false, entries: [] })).toEqual({
      version: "1.0.0",
      welcome: "pending",
      seenNews: [],
      dismissedTips: [],
    });
    expect(initialOnboardingRecord({ version: "1.0.0", priorUse: true, entries: [] })).toEqual({
      version: "1.0.0",
      welcome: "done",
      seenNews: [],
      dismissedTips: AREA_TIPS,
    });
  });
});

describe("advanceOnboardingVersion", () => {
  it("keeps the same record when the version is unchanged", () => {
    const current = record({ version: "0.35.0" });
    const result = advanceOnboardingVersion(current, "0.35.0");
    expect(result.previousVersion).toBeNull();
    expect(result.record).toBe(current);
  });

  it("reports the previous version after an update", () => {
    const current = record({ version: "0.35.0", seenNews: ["older"] });
    const result = advanceOnboardingVersion(current, "0.36.0");
    expect(result.previousVersion).toBe("0.35.0");
    expect(result.record).toEqual({ ...current, version: "0.36.0" });
    expect(current.version).toBe("0.35.0");
  });
});

describe("applyOnboardingEvent", () => {
  it("records the welcome outcome and returns the same record when nothing changes", () => {
    const pending = record({ welcome: "pending" });
    const done = applyOnboardingEvent(pending, { kind: "welcome", status: "done" }, ENTRIES);
    expect(done.welcome).toBe("done");
    expect(pending.welcome).toBe("pending");
    expect(applyOnboardingEvent(done, { kind: "welcome", status: "done" }, ENTRIES)).toBe(done);
    expect(
      applyOnboardingEvent(done, { kind: "welcome", status: "deferred" }, ENTRIES).welcome,
    ).toBe("deferred");
  });

  it("adds only known, unseen change ids", () => {
    const start = record({ seenNews: ["older"] });
    const next = applyOnboardingEvent(
      start,
      { kind: "news-seen", ids: ["latest-a", "older", "unknown", "latest-a"] },
      ENTRIES,
    );
    expect(next.seenNews).toEqual(["older", "latest-a"]);
    expect(applyOnboardingEvent(next, { kind: "news-seen", ids: ["older"] }, ENTRIES)).toBe(next);
    expect(applyOnboardingEvent(next, { kind: "news-seen", ids: ["nope"] }, ENTRIES)).toBe(next);
  });

  it("dismisses known area tips and spotlights once", () => {
    const start = record();
    const area = applyOnboardingEvent(start, { kind: "tip-dismissed", id: "area:stage" }, ENTRIES);
    expect(area.dismissedTips).toEqual(["area:stage"]);
    const news = applyOnboardingEvent(
      area,
      { kind: "tip-dismissed", id: spotlightTipId("latest-b") },
      ENTRIES,
    );
    expect(news.dismissedTips).toEqual(["area:stage", "news:latest-b"]);
    expect(applyOnboardingEvent(news, { kind: "tip-dismissed", id: "area:stage" }, ENTRIES)).toBe(
      news,
    );
    // An entry without a spotlight has no tip to dismiss.
    expect(
      applyOnboardingEvent(news, { kind: "tip-dismissed", id: "news:oldest" }, ENTRIES),
    ).toBe(news);
    expect(applyOnboardingEvent(news, { kind: "tip-dismissed", id: "area:nowhere" }, ENTRIES)).toBe(
      news,
    );
  });

  it("restores area tips without bringing old change spotlights back", () => {
    const start = record({ dismissedTips: ["area:stage", "news:older", "area:docs"] });
    const reset = applyOnboardingEvent(start, { kind: "tips-reset" }, ENTRIES);
    expect(reset.dismissedTips).toEqual(["news:older"]);
    expect(applyOnboardingEvent(reset, { kind: "tips-reset" }, ENTRIES)).toBe(reset);
  });
});

describe("tips and spotlights", () => {
  it("lists every area tip and each spotlight as a known id", () => {
    expect([...knownTipIds(ENTRIES)].sort()).toEqual(
      [...AREA_TIPS, "news:latest-a", "news:latest-b", "news:older"].sort(),
    );
  });

  it("shows the newest undismissed spotlight for an area", () => {
    const none = record();
    expect(activeSpotlight(ENTRIES, none, "docs")?.id).toBe("latest-b");
    expect(
      activeSpotlight(ENTRIES, record({ dismissedTips: ["news:latest-b"] }), "docs")?.id,
    ).toBe("older");
    expect(
      activeSpotlight(ENTRIES, record({ dismissedTips: ["news:latest-b", "news:older"] }), "docs"),
    ).toBeNull();
    expect(activeSpotlight(ENTRIES, none, "effectiveness")).toBeNull();
  });

  it("shows the home tip only after the welcome was put off", () => {
    expect(areaTipVisible(record({ welcome: "done" }), "home")).toBe(false);
    expect(areaTipVisible(record({ welcome: "pending" }), "home")).toBe(false);
    expect(areaTipVisible(record({ welcome: "deferred" }), "home")).toBe(true);
    expect(
      areaTipVisible(record({ welcome: "deferred", dismissedTips: ["area:home"] }), "home"),
    ).toBe(false);
  });

  it("shows other area tips until they are dismissed", () => {
    expect(areaTipVisible(record(), "stage")).toBe(true);
    expect(areaTipVisible(record({ dismissedTips: ["area:stage"] }), "stage")).toBe(false);
    expect(areaTipVisible(record({ dismissedTips: ["area:stage"] }), "docs")).toBe(true);
  });

  it("returns unseen changes in list order", () => {
    expect(
      unseenNews(ENTRIES, record({ seenNews: ["latest-b", "oldest"] })).map((entry) => entry.id),
    ).toEqual(["latest-a", "older"]);
  });
});

describe("parseOnboardingRecord", () => {
  it("accepts a stored record and normalises its id lists", () => {
    expect(
      parseOnboardingRecord({
        version: "0.35.0",
        welcome: "deferred",
        seenNews: ["older", "older", "Bad Id", 3, "latest-a"],
        dismissedTips: ["area:stage", null, "news:older"],
        extra: true,
      }),
    ).toEqual({
      version: "0.35.0",
      welcome: "deferred",
      seenNews: ["older", "latest-a"],
      dismissedTips: ["area:stage", "news:older"],
    });
  });

  it.each([
    null,
    "record",
    [],
    { welcome: "done", seenNews: [], dismissedTips: [] },
    { version: "", welcome: "done", seenNews: [], dismissedTips: [] },
    { version: "x".repeat(65), welcome: "done", seenNews: [], dismissedTips: [] },
    { version: "1.0.0", welcome: "later", seenNews: [], dismissedTips: [] },
    { version: "1.0.0", welcome: "done", seenNews: "older", dismissedTips: [] },
    { version: "1.0.0", welcome: "done", seenNews: [], dismissedTips: {} },
  ])("rejects a malformed record: %j", (value) => {
    expect(parseOnboardingRecord(value)).toBeNull();
  });

  it("bounds the stored lists", () => {
    const many = Array.from({ length: 600 }, (_, index) => `id-${index}`);
    const parsed = parseOnboardingRecord({
      version: "1.0.0",
      welcome: "done",
      seenNews: many,
      dismissedTips: many,
    });
    expect(parsed?.seenNews).toHaveLength(500);
    expect(parsed?.dismissedTips).toHaveLength(500);
    // Ids are appended as they are seen, so the newest ones are kept.
    expect(parsed?.seenNews[0]).toBe("id-100");
    expect(parsed?.seenNews.at(-1)).toBe("id-599");
  });
});

describe("parseOnboardingEvent", () => {
  it.each([
    [{ kind: "welcome", status: "done" }, { kind: "welcome", status: "done" }],
    [{ kind: "welcome", status: "deferred" }, { kind: "welcome", status: "deferred" }],
    [
      { kind: "news-seen", ids: ["latest-a", "older"], extra: 1 },
      { kind: "news-seen", ids: ["latest-a", "older"] },
    ],
    [
      { kind: "tip-dismissed", id: "area:stage" },
      { kind: "tip-dismissed", id: "area:stage" },
    ],
    [{ kind: "tips-reset" }, { kind: "tips-reset" }],
  ])("accepts %j", (value, expected) => {
    expect(parseOnboardingEvent(value)).toEqual(expected);
  });

  it.each([
    null,
    "welcome",
    { kind: "unknown" },
    { kind: "welcome", status: "pending" },
    { kind: "welcome" },
    { kind: "news-seen", ids: "latest-a" },
    { kind: "news-seen", ids: ["latest-a", 4] },
    { kind: "news-seen", ids: ["../etc"] },
    { kind: "news-seen", ids: Array.from({ length: 101 }, (_, index) => `id-${index}`) },
    { kind: "tip-dismissed", id: 3 },
    { kind: "tip-dismissed", id: "x".repeat(81) },
  ])("rejects %j", (value) => {
    expect(parseOnboardingEvent(value)).toBeNull();
  });
});

describe("parseOnboardingSnapshot", () => {
  const stored = record({ version: "0.35.0" });

  it("accepts the host snapshot with and without a requested view", () => {
    expect(parseOnboardingSnapshot({ version: "0.35.0", record: stored })).toEqual({
      version: "0.35.0",
      record: stored,
    });
    expect(parseOnboardingSnapshot({ version: "0.35.0", record: stored, open: "welcome" })).toEqual(
      { version: "0.35.0", record: stored, open: "welcome" },
    );
    expect(
      parseOnboardingSnapshot({ version: "0.35.0", record: stored, open: "whats-new" })?.open,
    ).toBe("whats-new");
  });

  it.each([
    null,
    { record: stored },
    { version: 35, record: stored },
    { version: "0.35.0", record: null },
    { version: "0.35.0", record: stored, open: "tour" },
  ])("rejects %j", (value) => {
    expect(parseOnboardingSnapshot(value)).toBeNull();
  });
});
