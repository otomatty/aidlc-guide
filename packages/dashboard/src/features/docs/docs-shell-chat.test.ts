import { describe, expect, it } from "vitest";
import { docsShellShowsChat } from "@/features/docs/docs-shell-chat.tsx";

describe("docsShellShowsChat", () => {
  it("keeps the home entry when there are no turns", () => {
    expect(docsShellShowsChat({ turns: [], busy: false, submitting: false })).toBe(false);
  });

  it("opens chat when turns exist so home does not stack answer cards", () => {
    expect(
      docsShellShowsChat({
        turns: [{ id: "1" } as never],
        busy: false,
        submitting: false,
      }),
    ).toBe(true);
  });

  it("opens chat while a reply is in flight", () => {
    expect(docsShellShowsChat({ turns: [], busy: true, submitting: false })).toBe(true);
    expect(docsShellShowsChat({ turns: [], busy: false, submitting: true })).toBe(true);
  });
});
