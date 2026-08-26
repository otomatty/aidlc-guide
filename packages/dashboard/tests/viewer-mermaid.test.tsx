import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * FR-6.3 / S-AV-4 / P-AV-3. `mermaid` itself is mocked: what is under test is
 * this unit's glue — the strict configuration, the module-scope memo, and the
 * "never crash, fall back to code" rule — not the diagram library.
 */

const render_ = vi.fn(async (_id: string, code: string) => {
  if (code.includes("boom")) throw new Error("Parse error");
  return { svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>ok</text></svg>' };
});
const initialize = vi.fn();

vi.mock("mermaid", () => ({ default: { initialize, render: render_ } }));

async function load(): Promise<typeof import("../src/viewer/MermaidBlock.tsx")> {
  return await import("../src/viewer/MermaidBlock.tsx");
}

afterEach(async () => {
  const { resetMermaidEngine } = await load();
  resetMermaidEngine();
  initialize.mockClear();
  render_.mockClear();
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("data-theme");
  document.body.className = "";
});

describe("MermaidBlock", () => {
  it("renders a valid diagram as inline SVG", async () => {
    const { MermaidBlock } = await load();
    render(<MermaidBlock code="graph TD\n A --> B" />);

    await waitFor(() => {
      expect(screen.getByTestId("mermaid-diagram").querySelector("svg")).not.toBeNull();
    });
    expect(screen.queryByTestId("mermaid-fallback")).toBeNull();
  });

  it("shows invalid source as code with a note, and does not throw", async () => {
    const { MermaidBlock } = await load();
    render(<MermaidBlock code="graph boom {{{" />);

    await waitFor(() => {
      expect(screen.getByTestId("mermaid-fallback")).toBeDefined();
    });
    expect(screen.getByText("graph boom {{{").tagName).toBe("CODE");
    expect(screen.getByText(/図として描画できません/)).toBeDefined();
  });

  it("initialises the library in strict mode with document theme tokens (S-AV-4 / P-AV-3)", async () => {
    const { MermaidBlock } = await load();
    render(
      <>
        <MermaidBlock code="graph TD\n A --> B" />
        <MermaidBlock code="graph TD\n C --> D" />
      </>,
    );

    await waitFor(() => {
      expect(render_).toHaveBeenCalledTimes(2);
    });
    expect(initialize).toHaveBeenCalled();
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: "strict",
        startOnLoad: false,
        theme: "base",
        themeVariables: expect.objectContaining({
          signalColor: expect.any(String),
          signalTextColor: expect.any(String),
        }),
      }),
    );
    for (const call of initialize.mock.calls) {
      const vars = (call[0] as { themeVariables?: Record<string, unknown> }).themeVariables;
      expect(JSON.stringify(vars ?? {})).not.toMatch(/oklch/i);
    }
  });

  it("treats unparseable SVG from the library as a render failure, not as markup", async () => {
    render_.mockImplementationOnce(async () => ({ svg: "<svg><unclosed>" }));
    const { MermaidBlock } = await load();
    render(<MermaidBlock code="graph TD\n A --> B" />);

    await waitFor(() => {
      expect(screen.getByTestId("mermaid-fallback")).toBeDefined();
    });
  });

  it("re-renders when the document theme class changes, without new source", async () => {
    const { MermaidBlock } = await load();
    render(<MermaidBlock code="graph TD\n A --> B" />);

    await waitFor(() => {
      expect(render_).toHaveBeenCalledTimes(1);
    });

    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("data-theme", "dark");

    await waitFor(() => {
      expect(render_).toHaveBeenCalledTimes(2);
    });
    expect(render_.mock.calls.map((call) => call[1])).toEqual([
      render_.mock.calls[0]?.[1],
      render_.mock.calls[0]?.[1],
    ]);
  });

  it("serializes oklch computed colors to a mermaid-safe token", async () => {
    const spy = vi.spyOn(window, "getComputedStyle").mockReturnValue({
      color: "oklch(0.62 0.12 180)",
    } as CSSStyleDeclaration);
    try {
      const { MermaidBlock } = await load();
      render(<MermaidBlock code="graph TD\n A --> B" />);
      await waitFor(() => {
        expect(initialize).toHaveBeenCalled();
      });
      for (const call of initialize.mock.calls) {
        const vars = (call[0] as { themeVariables?: Record<string, unknown> }).themeVariables;
        expect(JSON.stringify(vars ?? {})).not.toMatch(/oklch/i);
      }
    } finally {
      spy.mockRestore();
    }
  });
});
