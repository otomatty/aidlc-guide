import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogTrigger } from "./dialog.tsx";
import { HoverCard, HoverCardTrigger } from "./hover-card.tsx";

describe("trigger style ownership", () => {
  it("owns the screenshot appearance without leaking the variant to the button", () => {
    render(
      <Dialog>
        <DialogTrigger variant="screenshot">Screenshot</DialogTrigger>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Screenshot" });
    expect(trigger.className.split(" ")).toEqual(
      expect.arrayContaining([
        "cursor-zoom-in",
        "rounded-lg",
        "border",
        "bg-muted",
        "text-left",
        "outline-none",
        "focus-visible:ring-3",
        "focus-visible:ring-ring/50",
      ]),
    );
    expect(trigger.getAttribute("variant")).toBeNull();
  });

  it("keeps the default dialog trigger unstyled and forwards its className", () => {
    render(
      <Dialog>
        <DialogTrigger className="w-full">Default dialog</DialogTrigger>
      </Dialog>,
    );
    expect(screen.getByRole("button", { name: "Default dialog" }).className).toBe("w-full");
  });

  it("owns the explanation appearance on a rendered native button", () => {
    render(
      <HoverCard>
        <HoverCardTrigger
          variant="explain"
          render={<button type="button" aria-label="Field explanation" />}
        >
          Field explanation
        </HoverCardTrigger>
      </HoverCard>,
    );
    const trigger = screen.getByRole("button", { name: "Field explanation" });
    expect(trigger.className.split(" ")).toEqual(
      expect.arrayContaining([
        "cursor-help",
        "rounded-sm",
        "border-dashed",
        "border-transparent",
        "px-1",
        "py-0.5",
        "text-left",
        "wrap-anywhere",
        "hover:border-border",
        "hover:bg-muted",
        "focus-visible:border-border",
        "focus-visible:bg-muted",
        "focus-visible:outline-none",
      ]),
    );
    expect(trigger.getAttribute("type")).toBe("button");
    expect(trigger.getAttribute("variant")).toBeNull();
  });

  it("keeps the default hover trigger unstyled and forwards its className", () => {
    render(
      <HoverCard>
        <HoverCardTrigger className="w-full" href="#field">
          Default preview
        </HoverCardTrigger>
      </HoverCard>,
    );
    expect(screen.getByRole("link", { name: "Default preview" }).className).toBe("w-full");
  });
});
