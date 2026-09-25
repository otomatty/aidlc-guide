import { describe, expect, it } from "vitest";
import { ONBOARDING_AREAS, ONBOARDING_TARGETS, WHATS_NEW } from "../src/index.ts";

/**
 * The shipped change list is data the host and the dashboard both key on:
 * stored seen-sets hold these ids, so a malformed or renamed entry would
 * silently re-announce or hide a change for every existing user.
 */
describe("WHATS_NEW", () => {
  it("is not empty", () => {
    expect(WHATS_NEW.length).toBeGreaterThan(0);
  });

  it("uses unique kebab-case ids", () => {
    const ids = WHATS_NEW.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("dates every entry with a real calendar day, newest first", () => {
    let previous = "9999-12-31";
    for (const entry of WHATS_NEW) {
      expect(entry.date, entry.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const parsed = new Date(`${entry.date}T00:00:00Z`);
      expect(parsed.toISOString().slice(0, 10), entry.id).toBe(entry.date);
      expect(entry.date <= previous, `${entry.id} is out of order`).toBe(true);
      previous = entry.date;
    }
  });

  it("writes short, trimmed titles and bodies", () => {
    for (const entry of WHATS_NEW) {
      expect(entry.title.trim(), entry.id).toBe(entry.title);
      expect(entry.body.trim(), entry.id).toBe(entry.body);
      expect(entry.title.length, entry.id).toBeGreaterThan(0);
      expect(entry.title.length, entry.id).toBeLessThanOrEqual(40);
      expect(entry.body.length, entry.id).toBeGreaterThan(0);
      expect(entry.body.length, entry.id).toBeLessThanOrEqual(200);
    }
  });

  it("points actions and spotlights at real destinations", () => {
    for (const entry of WHATS_NEW) {
      if (entry.action !== undefined) {
        expect(ONBOARDING_TARGETS, entry.id).toContain(entry.action.target);
        expect(entry.action.label.trim().length, entry.id).toBeGreaterThan(0);
      }
      if (entry.spotlight !== undefined) {
        expect(ONBOARDING_AREAS, entry.id).toContain(entry.spotlight.area);
        expect(entry.spotlight.text.trim().length, entry.id).toBeGreaterThan(0);
        expect(entry.spotlight.text.length, entry.id).toBeLessThanOrEqual(120);
      }
    }
  });
});
