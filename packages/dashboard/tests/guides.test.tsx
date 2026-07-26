import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuidesButton } from "../src/components/GuidesButton.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubGuidesApi(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === "/api/guides") {
      return new Response(
        JSON.stringify({
          ok: true,
          value: [
            { name: "README.md", title: "Index" },
            { name: "getting-started.md", title: "はじめに" },
          ],
        }),
      );
    }
    if (path.includes("/api/guides/getting-started.md")) {
      return new Response(
        JSON.stringify({
          ok: true,
          value: {
            name: "getting-started.md",
            title: "はじめに",
            markdown: "# はじめに\n\nHello.\n",
          },
        }),
      );
    }
    if (path.includes("/api/guides/README.md")) {
      return new Response(
        JSON.stringify({
          ok: true,
          value: {
            name: "README.md",
            title: "Index",
            markdown: "# Index\n\nSee [start](./getting-started.md).\n",
          },
        }),
      );
    }
    return new Response(JSON.stringify({ error: true, reason: "unexpected" }), { status: 500 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

describe("GuidesButton — in-app usage docs", () => {
  it("opens the panel and loads the first guide", async () => {
    stubGuidesApi();
    render(<GuidesButton />);

    await userEvent.click(screen.getByTestId("guides-open"));
    expect(screen.getByTestId("guides-panel")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("guide-item-README.md")).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByTestId("guides-body").textContent).toContain("See");
    });

    await userEvent.click(screen.getByTestId("guide-item-getting-started.md"));
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("はじめに");
    });
    await waitFor(() => {
      expect(screen.getByTestId("guides-body").textContent).toContain("Hello");
    });
  });
});
