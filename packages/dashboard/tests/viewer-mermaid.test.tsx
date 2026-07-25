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

  it("initialises the library exactly once, in strict mode (S-AV-4 / P-AV-3)", async () => {
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
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledWith({ securityLevel: "strict", startOnLoad: false });
  });

  it("treats unparseable SVG from the library as a render failure, not as markup", async () => {
    render_.mockImplementationOnce(async () => ({ svg: "<svg><unclosed>" }));
    const { MermaidBlock } = await load();
    render(<MermaidBlock code="graph TD\n A --> B" />);

    await waitFor(() => {
      expect(screen.getByTestId("mermaid-fallback")).toBeDefined();
    });
  });
});
