import { describe, expect, it } from "vitest";
import { stageJumpReaches, stageOrderOf } from "../src/audit/stage-jump.ts";
import { stateWithStages } from "./state-fixtures.ts";

const ORDER = ["functional-design", "nfr-design", "code-generation", "build-and-test"];

describe("stageOrderOf", () => {
  it("reads the Stage Progress rows in graph order", () => {
    expect(stageOrderOf(stateWithStages(ORDER))).toEqual(ORDER);
  });

  it.each([
    ["no state", null],
    ["an unsupported state version", "## Project Information\n- **State Version**: 99\n"],
    ["no Stage Progress rows", stateWithStages([])],
  ])("is unknown for %s", (_, text) => {
    expect(stageOrderOf(text)).toBeNull();
  });
});

describe("stageJumpReaches (aidlc-workflows v2.11.0)", () => {
  it.each([
    ["no Target", undefined, "functional-design", true],
    ["an empty Target", "", "functional-design", true],
    ["the Target itself", "code-generation", "code-generation", true],
    ["a stage after the Target", "nfr-design", "build-and-test", true],
    ["a stage before the Target", "code-generation", "functional-design", false],
    ["an unknown Target", "unknown-stage", "functional-design", true],
    ["a stage the graph does not know", "code-generation", "unknown-stage", true],
  ])("with %s", (_, target, slug, expected) => {
    expect(stageJumpReaches(target, slug, ORDER)).toBe(expected);
  });

  it("reaches every stage when the graph order is unknown", () => {
    expect(stageJumpReaches("code-generation", "functional-design", null)).toBe(true);
  });

  it("uses a duplicated slug's first position, as findIndex does", () => {
    const order = ["a", "b", "a", "c"];
    expect(stageJumpReaches("b", "a", order)).toBe(false);
    expect(stageJumpReaches("a", "b", order)).toBe(true);
  });
});
