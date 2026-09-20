import { describe, expect, it } from "vitest";
import { findCanonicalClassIssues } from "./check-canonical-classes.ts";

describe("findCanonicalClassIssues", () => {
  it("flags break-words, order-none, viewport max-width, min-w-[96px], title-actions grid, and boolean data variants", () => {
    const source = [
      'className="min-w-0 break-words font-medium"',
      'className="app-home data-[parked]:hidden"',
      'className="group-data-[open]:flex"',
      'className="group-data-[open]/menu:flex peer-data-[active]/tab:block"',
      'className="min-[820px]:order-none"',
      'className="z-50 max-w-[calc(100vw-2rem)] origin-(--transform-origin)"',
      'className="w-auto min-w-[96px] rounded-lg"',
      'className="has-data-[slot=card-action]:grid-cols-[1fr_auto]"',
      'className="[&_[data-slot=tabs-trigger]]:font-mono [&_[data-slot=tabs-trigger]]:text-xs"',
    ].join("\n");
    expect(findCanonicalClassIssues(source)).toEqual([
      { file: "", line: 1, found: "break-words", expected: "wrap-break-word" },
      { file: "", line: 5, found: "order-none", expected: "order-0" },
      {
        file: "",
        line: 6,
        found: "max-w-[calc(100vw-2rem)]",
        expected: "max-w-viewport-gutter",
      },
      { file: "", line: 7, found: "min-w-[96px]", expected: "min-w-24" },
      {
        file: "",
        line: 8,
        found: "grid-cols-[1fr_auto]",
        expected: "grid-cols-title-actions",
      },
      { file: "", line: 2, found: "data-[parked]:", expected: "data-parked:" },
      { file: "", line: 3, found: "group-data-[open]:", expected: "group-data-open:" },
      {
        file: "",
        line: 4,
        found: "group-data-[open]/menu:",
        expected: "group-data-open/menu:",
      },
      {
        file: "",
        line: 4,
        found: "peer-data-[active]/tab:",
        expected: "peer-data-active/tab:",
      },
      {
        file: "",
        line: 9,
        found: "[&_[data-slot=tabs-trigger]]:",
        expected: "**:data-[slot=tabs-trigger]:",
      },
      {
        file: "",
        line: 9,
        found: "[&_[data-slot=tabs-trigger]]:",
        expected: "**:data-[slot=tabs-trigger]:",
      },
    ]);
  });

  it("leaves valued data variants and canonical classes alone", () => {
    const source = [
      'className="data-parked:hidden wrap-break-word min-[820px]:order-0 max-w-viewport-gutter min-w-24 grid-cols-title-actions **:data-[slot=tabs-trigger]:font-mono"',
      'className="data-[side=bottom]:slide-in-from-top-2"',
      'className="has-data-[slot=card-footer]:pb-0"',
      'className="data-[selected=true]:font-semibold"',
      'className="group-data-[align=end]/message:self-end"',
    ].join("\n");
    expect(findCanonicalClassIssues(source)).toEqual([]);
  });
});
