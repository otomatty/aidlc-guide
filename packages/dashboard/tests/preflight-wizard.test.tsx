import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NowStrip } from "../src/components/NowStrip.tsx";
import { PreflightWizard } from "../src/components/PreflightWizard.tsx";
import { setTransport, type Transport } from "../src/services/transport/types.ts";

const PAYLOAD = {
  scan: {
    projectType: "Brownfield",
    languages: "TypeScript",
    frameworks: "Unknown",
    buildSystem: "bun (package.json)",
  },
  scopes: [
    {
      name: "bugfix",
      description: "Fix a specific bug",
      depth: "Minimal",
      skeleton: "off",
      executeCount: 7,
      totalCount: 33,
      gateCount: 4,
    },
  ],
  inference: null as unknown,
  plan: null as unknown,
  cli: { bun: true, claude: true },
  errors: [] as string[],
};

const WITH_PLAN = {
  ...PAYLOAD,
  inference: { scope: "bugfix", source: "keyword", matches: [{ scope: "bugfix", keyword: "fix" }] },
  plan: {
    scope: "bugfix",
    depth: "Minimal",
    skeleton: "off",
    executeCount: 7,
    totalCount: 33,
    gateCount: 4,
    phases: [
      {
        phase: "construction",
        stages: [
          {
            slug: "code-generation",
            number: "3.5",
            name: "Code Generation",
            phase: "construction",
            decision: "EXECUTE",
            leadAgent: "aidlc-developer-agent",
            gate: true,
            produces: ["src/"],
          },
        ],
      },
    ],
  },
};

const postMessage = vi.fn();
let getJson: ReturnType<typeof vi.fn<Transport["getJson"]>>;

beforeEach(() => {
  getJson = vi.fn<Transport["getJson"]>(async (path: string) =>
    path.includes("text=") ? { reached: true, body: WITH_PLAN } : { reached: true, body: PAYLOAD },
  );
  setTransport({
    getJson,
    postJson: async () => ({ ok: true, status: 200, body: null }),
    subscribe: () => () => {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  postMessage.mockClear();
});

describe("PreflightWizard", () => {
  beforeEach(() => {
    vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
  });

  it("loads static preflight on mount and disables start on empty text", async () => {
    render(<PreflightWizard hint="hint" />);
    await waitFor(() => expect(getJson).toHaveBeenCalledWith("/api/preflight"));
    expect((screen.getByTestId("preflight-start") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Brownfield/)).toBeDefined();
  });

  it("debounces typing, shows inferred scope, gates count and disclaimer", async () => {
    const user = userEvent.setup();
    render(<PreflightWizard hint="hint" />);
    await user.type(screen.getByTestId("preflight-text"), "fix the login bug");
    await waitFor(() =>
      expect(getJson).toHaveBeenCalledWith(
        `/api/preflight?text=${encodeURIComponent("fix the login bug")}`,
      ),
    );
    await screen.findByTestId("preflight-readout");
    expect(screen.getByTestId("preflight-scope").textContent).toContain("bugfix");
    expect(screen.getByTestId("preflight-scope").textContent).toContain("fix");
    expect(screen.getByTestId("preflight-gates").textContent).toContain("4");
    // プレビュー ≠ 約束 の注記(spec §4)。
    expect(screen.getByText(/これは見通しです/)).toBeDefined();
    // EXECUTE/SKIP はテキストラベル(色のみ禁止)。
    expect(screen.getByText("EXECUTE")).toBeDefined();
  });

  it("start posts start-workflow with the raw text", async () => {
    const user = userEvent.setup();
    render(<PreflightWizard hint="hint" />);
    await user.type(screen.getByTestId("preflight-text"), "fix the login bug");
    await waitFor(() =>
      expect((screen.getByTestId("preflight-start") as HTMLButtonElement).disabled).toBe(false),
    );
    await user.click(screen.getByTestId("preflight-start"));
    expect(postMessage).toHaveBeenCalledWith({
      type: "start-workflow",
      text: "fix the login bug",
    });
  });

  it("degrades to static info with a setup hint when subprocess data is missing", async () => {
    getJson.mockImplementation(async () => ({
      reached: true,
      body: { ...PAYLOAD, scan: null, errors: ["detect-failed"] },
    }));
    render(<PreflightWizard hint="hint" />);
    await screen.findByTestId("preflight-degraded");
    // 静的カタログは出る。
    expect(screen.getByText(/bugfix/)).toBeDefined();
  });
});

describe("NowStrip empty branch", () => {
  it("renders the wizard in a VS Code webview", () => {
    vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
    render(<NowStrip state={{ kind: "empty", hint: "h" }} onRetry={() => {}} />);
    expect(screen.getByTestId("preflight-text")).toBeDefined();
  });

  it("keeps the plain EmptyState outside the webview (browser/hostMode)", () => {
    // No acquireVsCodeApi stub = browser.
    render(<NowStrip state={{ kind: "empty", hint: "h" }} onRetry={() => {}} />);
    expect(screen.queryByTestId("preflight-text")).toBeNull();
    expect(screen.getByText("ワークフローはまだありません")).toBeDefined();
  });
});
