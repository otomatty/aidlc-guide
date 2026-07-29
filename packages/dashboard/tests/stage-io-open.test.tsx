import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailPanel } from "../src/components/DetailPanel.tsx";
import { StageCard } from "../src/components/StageCard.tsx";
import { StoreProvider } from "../src/store/context.tsx";
import type { AppState } from "../src/store/state.ts";
import { matrix, stageDoc, workflow } from "./fixtures.ts";

const noop = (): void => {};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stage I/O artifact links", () => {
  it("uses the displayed unit path and opens it beside the dashboard", async () => {
    const postMessage = vi.fn();
    vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), "http://dashboard.test");
      if (url.pathname === "/api/io-paths") {
        const unit = url.searchParams.get("unit");
        return new Response(
          JSON.stringify({
            ok: true,
            value: {
              stage: "functional-design",
              unit,
              inputs: { "requirements-analysis": null },
              outputs: {
                "business-rules":
                  unit === "ops-guides"
                    ? "construction/ops-guides/functional-design/business-rules.md"
                    : "construction/reader-core/functional-design/business-rules.md",
              },
            },
          }),
        );
      }
      return new Response(JSON.stringify({ ok: true, value: "# Artifact" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const preloaded: Partial<AppState> = {
      selected: { kind: "stage", slug: "functional-design" },
      workflow: { kind: "success", value: workflow({ currentStage: "functional-design" }) },
      matrix: {
        kind: "success",
        value: matrix({
          cells: [
            {
              unit: "reader-core",
              stage: "functional-design",
              files: ["business-rules.md"],
              verdict: "READY",
            },
            {
              unit: "ops-guides",
              stage: "functional-design",
              files: ["business-rules.md"],
              verdict: "READY",
            },
          ],
        }),
      },
      stageDoc: {
        "functional-design": {
          kind: "success",
          value: stageDoc({
            slug: "functional-design",
            inputs: ["requirements-analysis"],
            outputs: ["business-rules"],
          }),
        },
      },
    };

    render(
      <StoreProvider preloaded={preloaded}>
        <DetailPanel />
      </StoreProvider>,
    );

    const open = await screen.findByTestId("io-open-business-rules");
    expect(screen.queryByTestId("io-open-requirements-analysis")).toBeNull();
    expect(screen.getByText("requirements-analysis").tagName).toBe("LI");

    await userEvent.click(open);
    expect(postMessage).toHaveBeenLastCalledWith({
      type: "open-file",
      path: "construction/reader-core/functional-design/business-rules.md",
      line: null,
      beside: true,
      base: "record",
    });

    postMessage.mockClear();
    await userEvent.click(screen.getByRole("tab", { name: "ops-guides" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("unit=ops-guides"),
        expect.anything(),
      );
    });
    await userEvent.click(await screen.findByTestId("io-open-business-rules"));
    expect(postMessage).toHaveBeenLastCalledWith({
      type: "open-file",
      path: "construction/ops-guides/functional-design/business-rules.md",
      line: null,
      beside: true,
      base: "record",
    });
  });

  it("keeps resolved I/O paths as text outside a VS Code webview", () => {
    render(
      <StoreProvider>
        <StageCard
          doc={stageDoc({ outputs: ["code-summary"] })}
          isCurrent={false}
          onOpenStage={noop}
          ioPaths={{
            stage: "code-generation",
            unit: "reader-core",
            inputs: {},
            outputs: { "code-summary": "construction/reader-core/code-generation/code-summary.md" },
          }}
        />
      </StoreProvider>,
    );

    expect(screen.queryByTestId("io-open-code-summary")).toBeNull();
    expect(screen.getByText("code-summary").tagName).toBe("LI");
  });
});
