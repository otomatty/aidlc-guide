import { describe, expect, it } from "vitest";
import { FORK_CAVEAT, HELP_TEXT } from "../src/help.ts";

// FR-3.4 / BR-3: the fork limitation and the /branch alternative are part of the
// contract, not decoration — assert they are actually in the text users see.
describe("HELP_TEXT", () => {
  it("documents all three commands", () => {
    expect(HELP_TEXT).toContain("btw --fork");
    expect(HELP_TEXT).toContain("btw -p");
    expect(HELP_TEXT).toContain("btw --help");
  });

  it("states that sessions are always read-only plan mode", () => {
    expect(HELP_TEXT).toContain("--permission-mode plan");
  });

  it("names the --fork-session JSONL flush limitation", () => {
    expect(HELP_TEXT).toContain("--fork-session");
    expect(HELP_TEXT).toMatch(/flush/i);
  });

  it("recommends /branch in the mainline as the first choice", () => {
    expect(HELP_TEXT).toContain("/branch");
  });
});

describe("FORK_CAVEAT", () => {
  it("repeats the flush limitation and the /branch alternative at launch time", () => {
    expect(FORK_CAVEAT).toMatch(/flush/i);
    expect(FORK_CAVEAT).toContain("/branch");
  });
});
