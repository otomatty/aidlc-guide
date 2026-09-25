import { afterEach, describe, expect, it } from "vitest";
import { stage, workflow } from "@tests/fixtures.ts";
import { buildTourSteps, findAnchor } from "./steps.ts";

afterEach(() => {
  document.body.replaceChildren();
});

describe("buildTourSteps", () => {
  it("walks from the intent to the menu through the current stage", () => {
    const steps = buildTourSteps(workflow());
    expect(steps.map((step) => step.id)).toEqual([
      "intent",
      "now",
      "rail",
      "gate",
      "outputs",
      "menu",
    ]);
    expect(steps.find((step) => step.id === "rail")?.anchor).toEqual({
      attr: "data-testid",
      value: "stage-rail-item-code-generation",
    });
    expect(steps.find((step) => step.id === "gate")?.route).toEqual({
      name: "stage",
      slug: "code-generation",
    });
    for (const step of steps) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });

  it("uses the first executed stage when no stage is current", () => {
    const steps = buildTourSteps(
      workflow({
        currentStage: null,
        stages: [stage("market-research", { execution: "SKIP" }), stage("requirements-analysis")],
      }),
    );
    expect(steps.find((step) => step.id === "gate")?.route).toEqual({
      name: "stage",
      slug: "requirements-analysis",
    });
  });

  it("falls back to any stage, and skips stage steps without one", () => {
    const skipped = buildTourSteps(
      workflow({ currentStage: null, stages: [stage("market-research", { execution: "SKIP" })] }),
    );
    expect(skipped.find((step) => step.id === "rail")?.anchor.value).toBe(
      "stage-rail-item-market-research",
    );
    expect(
      buildTourSteps(workflow({ currentStage: null, stages: [] })).map((step) => step.id),
    ).toEqual(["intent", "now", "menu"]);
    expect(buildTourSteps(null).map((step) => step.id)).toEqual(["intent", "menu"]);
  });
});

describe("findAnchor", () => {
  it("matches the attribute value exactly, without building a selector from data", () => {
    document.body.innerHTML = `
      <button data-testid="stage-rail-item-code-generation-2">other</button>
      <button data-testid="stage-rail-item-code-generation">target</button>`;
    expect(
      findAnchor({ attr: "data-testid", value: "stage-rail-item-code-generation" })?.textContent,
    ).toBe("target");
    expect(findAnchor({ attr: "data-testid", value: "missing" })).toBeNull();
  });

  it("ignores content parked under another page", () => {
    document.body.innerHTML = `
      <div data-parked=""><span data-onboarding="gate-requirement">hidden</span></div>
      <span data-onboarding="gate-requirement">shown</span>`;
    expect(findAnchor({ attr: "data-onboarding", value: "gate-requirement" })?.textContent).toBe(
      "shown",
    );
    document.body.innerHTML = `<div data-parked=""><span data-onboarding="x">hidden</span></div>`;
    expect(findAnchor({ attr: "data-onboarding", value: "x" })).toBeNull();
  });
});
