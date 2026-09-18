import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import type { CliManagementState } from "../src/cli-management.ts";
import type { NativeDoctorReport } from "../src/doctor-output.ts";
import { findHarnessConflict } from "../src/harness-conflicts.ts";
import { type SetupPanelMode, setupHtml } from "../src/setup-html.ts";
import type { SetupSnapshot } from "../src/setup-state.ts";

vi.mock("../src/native-setup.ts", () => ({
  SETUP_RELEASE: "test-release",
  INSTALL_GUIDE_URL: "https://github.com/awslabs/aidlc-workflows/releases/tag/vtest-release",
}));

const empty: SetupSnapshot = {
  root: "C:\\project & docs",
  configured: false,
  projectPresent: false,
  native: null,
  version: null,
  harnesses: [],
  docsReady: false,
  preference: undefined,
};

const readyCli: CliManagementState = {
  machineVersion: "test-release",
  projectPin: null,
  projectVersion: null,
  effectiveVersion: "test-release",
  target: "test-release",
  targetInstalled: true,
  launcherReady: true,
  setupReady: true,
  canPrepare: false,
  canUpdate: false,
  status: "ready",
  message: "CLIを利用できます。",
  updateMessage: "CLIは導入済みです。",
};
const prepared: SetupSnapshot = { ...empty, cli: readyCli };

const diagnosticReport: NativeDoctorReport = {
  version: "2.8.1",
  executedAt: "2026-09-11T02:34:56.000Z",
  outcome: "failed",
  summary: "診断が完了しました。問題のある項目があります。",
  checks: [
    {
      section: "machine",
      status: "ok",
      label: "Git を利用できます。",
      originalLabel: "Git available",
      translated: true,
    },
    {
      section: "project",
      status: "warn",
      label: "フックを確認してください。",
      fix: "設定を更新してください。\naidlc setup",
      originalLabel: "Check hooks",
      originalFix: "Update settings.\naidlc setup",
      translated: true,
      fixTranslated: true,
    },
    {
      section: "framework",
      status: "fail",
      label: "本体のファイルが不足しています。",
      originalLabel: "Framework files missing",
      translated: true,
    },
  ],
  counts: { passed: 1, warnings: 1, failed: 1 },
  rawOutput: "Git available\nCheck hooks\nFramework files missing",
  unparsedOutput: [],
};

function webview(
  options: {
    trusted?: boolean;
    saved?: unknown;
    snapshot?: SetupSnapshot;
    mode?: SetupPanelMode;
    creatingProject?: boolean;
  } = {},
) {
  const postMessage = vi.fn();
  const setState = vi.fn();
  const dom = new JSDOM(
    setupHtml(
      options.snapshot ?? empty,
      ["cursor"],
      options.trusted ?? true,
      "testnonce",
      options.mode,
      "test-extension",
      options.creatingProject,
    ),
    {
      runScripts: "dangerously",
      beforeParse(window) {
        Object.assign(window, {
          acquireVsCodeApi: () => ({
            postMessage,
            getState: () => options.saved ?? null,
            setState,
          }),
        });
      },
    },
  );
  return {
    dom,
    doc: dom.window.document,
    postMessage,
    setState,
    message(data: unknown) {
      dom.window.dispatchEvent(new dom.window.MessageEvent("message", { data }));
    },
  };
}

describe("setup webview", () => {
  it("treats official docs as a text link and explains Git Bash launcher lookup", () => {
    const pending = webview();
    const docs = pending.doc.querySelector<HTMLAnchorElement>("#docs");
    expect(docs?.tagName).toBe("A");
    expect(docs?.className).toBe("text-link");
    expect(docs?.getAttribute("href")).toBe(
      "https://github.com/awslabs/aidlc-workflows/releases/tag/vtest-release",
    );
    expect(pending.doc.body.textContent).not.toContain("aidlc.cmd --version");
    docs?.click();
    expect(pending.postMessage).toHaveBeenLastCalledWith({
      type: "docs",
      harnesses: ["cursor"],
    });
    pending.dom.window.close();

    const ready = webview({ snapshot: prepared });
    expect(ready.doc.querySelector("button#docs")).toBeNull();
    expect(ready.doc.body.textContent).toContain("Windows の Git Bash では");
    expect(ready.doc.body.textContent).toContain("aidlc.cmd --version");
    expect(ready.doc.body.textContent).toContain("コマンド プロンプトと PowerShell");
    expect(ready.doc.querySelector("#cli-terminal")?.classList.contains("text-link")).toBe(true);
    ready.dom.window.close();

    const joining = webview({
      snapshot: {
        ...empty,
        projectPresent: true,
        harnesses: ["cursor", "claude"],
        version: "2.8.1",
      },
    });
    for (const id of ["add-tools", "run-doctor", "recheck", "update-workflows"]) {
      expect(joining.doc.querySelector(`#${id}`)?.classList.contains("text-link")).toBe(true);
    }
    expect(joining.doc.querySelector("#install")?.classList.contains("text-link")).toBeFalsy();
    expect(joining.doc.querySelector("#finish")?.classList.contains("text-link")).toBeFalsy();
    joining.dom.window.close();
  });

  it("requires CLI preparation before creating project files", () => {
    const view = webview();
    const install = view.doc.querySelector<HTMLButtonElement>("#install");
    const prepare = view.doc.querySelector<HTMLButtonElement>("#prepare-cli");
    expect(install?.disabled).toBe(true);
    expect(view.doc.querySelector("#selection-note")?.textContent).toContain("先に CLI を準備");
    install?.click();
    expect(view.postMessage).toHaveBeenCalledExactlyOnceWith({ type: "ready" });
    expect(prepare?.disabled).toBe(false);
    prepare?.click();
    expect(view.postMessage).toHaveBeenLastCalledWith({
      type: "prepare-cli",
      harnesses: ["cursor"],
    });
    view.message({ type: "busy", value: true });
    const sent = view.postMessage.mock.calls.length;
    prepare?.click();
    expect(view.postMessage).toHaveBeenCalledTimes(sent);
    view.message({ type: "busy", value: false });
    expect(prepare?.disabled).toBe(false);
    expect(install?.disabled).toBe(true);
    view.dom.window.close();

    const refreshed = webview({ snapshot: prepared });
    expect(refreshed.doc.querySelector<HTMLButtonElement>("#prepare-cli")?.disabled).toBe(true);
    expect(refreshed.doc.querySelector<HTMLButtonElement>("#install")?.disabled).toBe(false);
    refreshed.dom.window.close();
  });

  it("joins an existing project through CLI preparation and diagnosis without an install action", () => {
    const view = webview({
      snapshot: {
        ...empty,
        projectPresent: true,
        harnesses: ["cursor", "claude"],
        version: "2.8.1",
      },
    });
    expect(view.doc.querySelector("#install, input[name=harness], #check-update")).toBeNull();
    expect(view.doc.querySelector("h1")?.textContent).toBe("AI-DLC のセットアップ");
    expect(view.doc.body.textContent).toContain("既存の AI-DLC プロジェクトに参加");
    expect(view.doc.querySelector<HTMLButtonElement>("#finish")?.disabled).toBe(true);
    view.doc.querySelector<HTMLButtonElement>("#prepare-cli")?.click();
    expect(view.postMessage).toHaveBeenLastCalledWith({
      type: "prepare-cli",
      harnesses: ["cursor", "claude"],
    });
    view.doc.querySelector<HTMLButtonElement>("#run-doctor")?.click();
    expect(view.postMessage).toHaveBeenLastCalledWith({
      type: "run-doctor",
      harnesses: ["cursor", "claude"],
    });
    view.doc.querySelector<HTMLButtonElement>("#add-tools")?.click();
    expect(view.postMessage).toHaveBeenLastCalledWith({
      type: "add-tools",
      harnesses: ["cursor", "claude"],
    });
    view.doc.querySelector<HTMLButtonElement>("#update-workflows")?.click();
    expect(view.postMessage).toHaveBeenLastCalledWith({ type: "open-workflows-update" });
    expect(view.postMessage.mock.calls.some(([message]) => message.type === "install")).toBe(false);
    view.dom.window.close();
  });

  it("shows the existing project's pinned CLI version and retains readiness after a busy operation", () => {
    const view = webview({
      snapshot: {
        ...prepared,
        configured: true,
        projectPresent: true,
        version: "2.8.1",
        harnesses: ["cursor"],
        cli: {
          ...readyCli,
          projectPin: "2.8.1",
          projectVersion: "2.8.1",
          effectiveVersion: "2.8.1",
        },
      },
    });
    expect(view.doc.body.textContent).toContain("準備するバージョン：2.8.1");
    expect(view.doc.querySelector<HTMLButtonElement>("#finish")?.disabled).toBe(false);
    view.message({ type: "busy", value: true });
    expect(view.doc.querySelector<HTMLButtonElement>("#finish")?.disabled).toBe(true);
    view.message({ type: "busy", value: false });
    expect(view.doc.querySelector<HTMLButtonElement>("#finish")?.disabled).toBe(false);
    expect(view.doc.querySelector<HTMLButtonElement>("#prepare-cli")?.disabled).toBe(true);
    view.dom.window.close();
  });

  it("keeps the new-project selection available for retrying partially completed setup", () => {
    const view = webview({
      snapshot: { ...prepared, configured: true, projectPresent: true, harnesses: ["cursor"] },
      creatingProject: true,
    });
    expect(view.doc.querySelector("h1")?.textContent).toBe("AI-DLC のセットアップ");
    expect(view.doc.querySelector("#add-tools")).toBeNull();
    expect(view.doc.querySelector<HTMLInputElement>('input[value="cursor"]')?.disabled).toBe(true);
    const addition = view.doc.querySelector<HTMLInputElement>('input[value="claude"]');
    const install = view.doc.querySelector<HTMLButtonElement>("#install");
    addition?.click();
    expect(install?.disabled).toBe(false);
    expect(view.doc.querySelector<HTMLButtonElement>("#finish")?.disabled).toBe(true);
    install?.click();
    expect(view.postMessage).toHaveBeenLastCalledWith({
      type: "install",
      harnesses: ["cursor", "claude"],
    });
    addition?.click();
    expect(install?.disabled).toBe(true);
    expect(view.doc.querySelector<HTMLButtonElement>("#finish")?.disabled).toBe(false);
    view.dom.window.close();
  });

  it("keeps CLI preparation and project writes disabled in an untrusted workspace", () => {
    const view = webview({ trusted: false });
    view.message({ type: "busy", value: true });
    view.message({ type: "busy", value: false });
    for (const id of ["prepare-cli", "install", "finish"]) {
      const button = view.doc.querySelector<HTMLButtonElement>(`#${id}`);
      expect(button?.disabled).toBe(true);
      button?.click();
    }
    expect(view.postMessage).toHaveBeenCalledExactlyOnceWith({ type: "ready" });
    view.dom.window.close();
  });

  it("permits the first installation when shared state allows an older pin to be initialized", () => {
    const postMessage = vi.fn();
    const snapshot: SetupSnapshot = {
      ...prepared,
      version: "2.8.0",
      workflows: {
        root: empty.root,
        target: "2.8.1",
        projectPin: "2.8.0",
        tools: [],
        status: "not-installed",
        canInstall: true,
        canUpdate: false,
        message: "インストール時に固定バージョンを揃えます。",
      },
    };
    const dom = new JSDOM(setupHtml(snapshot, ["cursor"], true, "testnonce"), {
      runScripts: "dangerously",
      beforeParse(window) {
        Object.assign(window, {
          acquireVsCodeApi: () => ({ postMessage, getState: () => null, setState: vi.fn() }),
        });
      },
    });
    try {
      const install = dom.window.document.querySelector<HTMLButtonElement>("#install");
      expect(install?.disabled).toBe(false);
      expect(dom.window.document.getElementById("check-update")).toBeNull();
      install?.click();
      expect(postMessage).toHaveBeenLastCalledWith({ type: "install", harnesses: ["cursor"] });
    } finally {
      dom.window.close();
    }
  });
  it("installs multiple selected tools together and locks controls only while busy", () => {
    const postMessage = vi.fn();
    const dom = new JSDOM(setupHtml(prepared, ["cursor"], true, "testnonce"), {
      runScripts: "dangerously",
      beforeParse(window) {
        Object.assign(window, {
          acquireVsCodeApi: () => ({ postMessage, getState: () => null, setState: vi.fn() }),
        });
      },
    });
    const doc = dom.window.document;
    expect(doc.querySelectorAll(".card").length).toBe(3);
    expect(doc.querySelector("#status")?.getAttribute("aria-live")).toBe("polite");
    const codex = doc.querySelector<HTMLInputElement>('input[value="codex"]');
    if (!codex) throw new Error("missing harness selector");
    codex.click();
    expect(doc.querySelector("#start-command, #register-mcp, #bun-docs, #check-update")).toBeNull();
    expect([...doc.querySelectorAll(".steps > li h2")].map((node) => node.textContent)).toEqual([
      "このマシンの CLI を準備する",
      "プロジェクトを設定する",
      "aidlc doctor を実行する",
    ]);
    doc.querySelector<HTMLButtonElement>("#install")?.click();
    expect(postMessage).toHaveBeenLastCalledWith({
      type: "install",
      harnesses: ["cursor", "codex"],
    });
    expect(doc.querySelector<HTMLButtonElement>("#install")?.disabled).toBe(false);
    expect(doc.querySelector("#selection-note")?.textContent).toContain("2 個のツールを設定");
    doc.querySelector<HTMLInputElement>('input[value="cursor"]')?.click();
    doc.querySelector<HTMLButtonElement>("#install")?.click();
    expect(postMessage).toHaveBeenLastCalledWith({
      type: "install",
      harnesses: ["codex"],
    });
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", { data: { type: "busy", value: true } }),
    );
    expect(doc.querySelector<HTMLButtonElement>("#install")?.disabled).toBe(true);
    expect(codex.disabled).toBe(true);
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", { data: { type: "busy", value: false } }),
    );
    expect(doc.querySelector<HTMLButtonElement>("#install")?.disabled).toBe(false);
    expect(codex.disabled).toBe(false);
    expect(doc.querySelector<HTMLButtonElement>("#finish")?.disabled).toBe(true);
    dom.window.close();
  });
  it("blocks empty and conflicting selections before sending an install request", () => {
    const view = webview({ snapshot: prepared });
    const toggle = (id: string) =>
      view.doc.querySelector<HTMLInputElement>(`input[value="${id}"]`)?.click();
    const button = view.doc.querySelector<HTMLButtonElement>("#install");
    toggle("cursor");
    expect(button?.disabled).toBe(true);
    expect(view.doc.querySelector("#selection-note")?.textContent).toContain("1つ以上選択");
    for (const [first, second] of [
      ["copilot", "opencode"],
      ["kiro", "kiro-ide"],
    ] as const) {
      if (!first || !second) throw new Error("missing pair");
      toggle(first);
      expect(button?.disabled).toBe(false);
      toggle(second);
      expect(button?.disabled).toBe(true);
      expect(view.doc.querySelector("#selection-note")?.textContent).toBe(
        findHarnessConflict([first, second])?.message,
      );
      toggle(first);
      toggle(second);
    }
    expect(view.postMessage.mock.calls.some(([message]) => message.type === "install")).toBe(false);
    view.dom.window.close();
  });
  it("allows multiple additions while keeping installed tools checked and preserved", () => {
    const postMessage = vi.fn();
    const dom = new JSDOM(
      setupHtml(
        { ...prepared, configured: true, harnesses: ["cursor"] },
        ["cursor"],
        true,
        "nonce",
        "install",
      ),
      {
        runScripts: "dangerously",
        beforeParse(window) {
          Object.assign(window, {
            acquireVsCodeApi: () => ({ postMessage, getState: () => null, setState: vi.fn() }),
          });
        },
      },
    );
    const doc = dom.window.document;
    expect(doc.querySelector("h1")?.textContent).toBe("AI-DLC のツールを追加");
    expect(doc.querySelectorAll(".card")).toHaveLength(3);
    expect(doc.querySelector("#finish, #register-mcp, #start-command")).toBeNull();
    expect(doc.querySelector<HTMLInputElement>('input[value="cursor"]')?.disabled).toBe(true);
    expect(doc.querySelector<HTMLInputElement>('input[value="claude"]')?.disabled).toBe(false);
    expect(doc.querySelector<HTMLButtonElement>("#install")?.disabled).toBe(true);
    doc.querySelector<HTMLInputElement>('input[value="cursor"]')?.click();
    expect(doc.querySelector<HTMLInputElement>('input[value="cursor"]')?.checked).toBe(true);
    doc.querySelector<HTMLInputElement>('input[value="claude"]')?.click();
    doc.querySelector<HTMLInputElement>('input[value="codex"]')?.click();
    expect(doc.querySelector("#selection-note")?.textContent).toContain("2 個のツールを追加");
    expect(doc.querySelector("#install")?.textContent).toBe("選択したツールを追加");
    doc.querySelector<HTMLButtonElement>("#install")?.click();
    expect(postMessage).toHaveBeenLastCalledWith({
      type: "install",
      harnesses: ["cursor", "claude", "codex"],
    });
    for (const value of [true, false])
      dom.window.dispatchEvent(
        new dom.window.MessageEvent("message", { data: { type: "busy", value } }),
      );
    expect(doc.querySelector<HTMLInputElement>('input[value="cursor"]')?.disabled).toBe(true);
    expect(doc.querySelector<HTMLInputElement>('input[value="claude"]')?.disabled).toBe(false);
    doc.querySelector<HTMLInputElement>('input[value="claude"]')?.click();
    doc.querySelector<HTMLInputElement>('input[value="codex"]')?.click();
    expect(doc.querySelector<HTMLButtonElement>("#install")?.disabled).toBe(true);
    dom.window.close();
  });
  it.each([
    ["copilot", "opencode"],
    ["kiro", "kiro-ide"],
  ] as const)(
    "blocks adding %s's conflicting tool %s even when omitted from selection",
    (installed, addition) => {
      const postMessage = vi.fn();
      const dom = new JSDOM(
        setupHtml(
          { ...prepared, configured: true, harnesses: [installed] },
          [addition],
          true,
          "nonce",
          "install",
        ),
        {
          runScripts: "dangerously",
          beforeParse(window) {
            Object.assign(window, {
              acquireVsCodeApi: () => ({ postMessage, getState: () => null, setState: vi.fn() }),
            });
          },
        },
      );
      expect(
        dom.window.document.querySelector<HTMLInputElement>(`input[value="${installed}"]`)?.checked,
      ).toBe(true);
      expect(dom.window.document.querySelector<HTMLButtonElement>("#install")?.disabled).toBe(true);
      expect(dom.window.document.querySelector("#selection-note")?.textContent).toBe(
        findHarnessConflict([installed, addition])?.message,
      );
      dom.window.document.querySelector<HTMLButtonElement>("#install")?.click();
      expect(postMessage.mock.calls.some(([message]) => message.type === "install")).toBe(false);
      dom.window.close();
    },
  );
  it("restores per-tool partial results safely and opens each diagnostic report", () => {
    const view = webview();
    const results = [
      {
        id: "cursor",
        status: "configured",
        message: "設定しました",
        doctorReport: diagnosticReport,
      },
      { id: "claude", status: "failed", message: '<img src=x onerror="alert(1)">設定失敗' },
    ];
    view.message({
      type: "restore",
      log: "",
      text: "",
      error: false,
      doctorReport: null,
      installResults: results,
    });
    const list = view.doc.querySelector("#install-results");
    expect(list?.textContent).toContain("Cursor：設定完了");
    expect(list?.textContent).toContain("Claude Code：失敗");
    expect(list?.querySelector("img")).toBeNull();
    list?.querySelector<HTMLButtonElement>("button")?.click();
    expect(view.doc.querySelector("#doctor-result")?.textContent).toContain(
      diagnosticReport.summary,
    );
    view.message({ type: "install-results", results: [] });
    expect(list?.children).toHaveLength(0);
    view.dom.window.close();
  });
  it("escapes workspace and version content and uses a nonce-only script policy", () => {
    const html = setupHtml(
      { ...empty, root: '</code><script>alert("x")</script>', version: "<img src=x>" },
      ["claude"],
      true,
      "nonce",
    );
    const dom = new JSDOM(html);
    expect(dom.window.document.querySelectorAll("script").length).toBe(1);
    expect(dom.window.document.querySelector("img")).toBeNull();
    expect(html).not.toContain("unsafe-inline");
    expect(html).toContain("script-src 'nonce-nonce'");
    dom.window.close();
  });
  it("enables finishing an empty configured project and disables actions when untrusted", () => {
    for (const trusted of [true, false]) {
      const dom = new JSDOM(
        setupHtml(
          { ...prepared, configured: true, harnesses: ["cursor"] },
          ["cursor"],
          trusted,
          "nonce",
        ),
      );
      expect(dom.window.document.querySelector<HTMLButtonElement>("#finish")?.disabled).toBe(
        !trusted,
      );
      expect(dom.window.document.querySelector("#register-mcp")).toBeNull();
      expect(dom.window.document.querySelector<HTMLButtonElement>("#run-doctor")?.disabled).toBe(
        !trusted,
      );
      dom.window.close();
    }
  });

  it("renders Japanese diagnostic checks, advice, counts, version and execution time", () => {
    const view = webview();
    view.message({ type: "doctor-report", report: diagnosticReport });
    const result = view.doc.querySelector("#doctor-result");
    expect(result?.getAttribute("aria-live")).toBe("polite");
    expect(result?.textContent).toContain(diagnosticReport.summary);
    expect(result?.textContent).toContain("本体バージョン：2.8.1");
    expect(result?.querySelector("time")?.getAttribute("datetime")).toBe(
      diagnosticReport.executedAt,
    );
    expect([...view.doc.querySelectorAll(".doctor-counts li")].map((el) => el.textContent)).toEqual(
      ["正常 1 件", "要確認 1 件", "問題あり 1 件"],
    );
    expect([...(result?.querySelectorAll("h3") ?? [])].map((el) => el.textContent)).toEqual([
      "実行環境",
      "プロジェクト",
      "AI-DLC 本体",
    ]);
    expect([...view.doc.querySelectorAll(".doctor-state")].map((el) => el.textContent)).toEqual([
      "正常",
      "要確認",
      "問題あり",
    ]);
    expect(view.doc.querySelector(".doctor-fix")?.textContent).toBe(
      "対処方法：設定を更新してください。\naidlc setup",
    );
    expect(view.doc.querySelector("#doctor-original pre")?.textContent).toBe(
      diagnosticReport.rawOutput,
    );
    expect(view.doc.querySelector<HTMLDetailsElement>("#doctor-original")?.open).toBe(false);
    expect(view.doc.querySelector("#run-doctor")?.textContent).toBe("診断を再実行");
    expect(view.setState).toHaveBeenLastCalledWith({
      log: "",
      status: "",
      doctorReport: diagnosticReport,
    });
    view.dom.window.close();
  });

  it("keeps unknown labels and remedies visible and renders diagnostic output as text", () => {
    const view = webview();
    const original = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    view.message({
      type: "doctor-report",
      report: {
        ...diagnosticReport,
        summary: `新しい診断項目があります。${original}`,
        checks: [
          {
            section: "other",
            status: "warn",
            label: "日本語訳が未対応の項目です。",
            originalLabel: original,
            translated: false,
            fix: "日本語訳が未対応の対処方法です。",
            originalFix: "Run <repair> & retry",
            fixTranslated: false,
          },
        ],
        rawOutput: original,
        unparsedOutput: ["New output", original],
      },
    });
    const result = view.doc.querySelector("#doctor-result");
    expect(result?.textContent).toContain("日本語訳が未対応の項目です。");
    expect(result?.textContent).toContain(`原文：${original}`);
    expect(result?.textContent).toContain("対処方法の原文：Run <repair> & retry");
    expect(result?.textContent).toContain("形式を読み取れない出力があります。");
    expect(result?.querySelector(".note")?.closest("details")).toBeNull();
    expect(result?.querySelector("pre")?.textContent).toBe(`New output\n${original}`);
    expect(result?.querySelector("#doctor-original pre")?.textContent).toBe(original);
    expect(view.doc.querySelectorAll("script")).toHaveLength(1);
    expect(result?.querySelector("img, repair, script")).toBeNull();
    view.dom.window.close();
  });

  it("replaces earlier results and distinguishes an unavailable diagnosis from check failures", () => {
    const view = webview();
    view.message({ type: "doctor-report", report: diagnosticReport });
    view.message({
      type: "doctor-report",
      report: {
        ...diagnosticReport,
        version: "",
        outcome: "unavailable",
        summary: "診断の実行がタイムアウトしました。もう一度実行してください。",
        executedAt: "2026-09-11T02:35:56.000Z",
        checks: [],
        counts: null,
        rawOutput: "process timed out",
      },
    });
    const result = view.doc.querySelector("#doctor-result");
    expect(result?.textContent).toContain("診断の実行がタイムアウトしました。");
    expect(result?.textContent).toContain("本体バージョン：未取得");
    expect(result?.querySelector(".doctor-summary")?.classList.contains("doctor-fail")).toBe(true);
    expect(result?.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-09-11T02:35:56.000Z",
    );
    expect(result?.querySelector(".doctor-counts, .doctor-check")).toBeNull();
    expect(result?.textContent).not.toContain("Git を利用できます。");
    expect(view.doc.querySelectorAll("#doctor-original")).toHaveLength(1);
    view.dom.window.close();
  });

  it("labels each tool and keeps its status, checks, counts and original output separate", () => {
    const view = webview();
    const healthy = {
      ...diagnosticReport,
      outcome: "ok",
      summary: "問題はありません。",
      checks: [diagnosticReport.checks[0]],
      counts: { passed: 1, warnings: 0, failed: 0 },
      rawOutput: "Claude healthy",
    };
    const reports = [
      { id: "claude", report: healthy },
      { id: "cursor", report: diagnosticReport },
    ];
    view.message({ type: "doctor-reports", reports });
    const sections = [...view.doc.querySelectorAll(".doctor-tool")];
    expect(sections).toHaveLength(2);
    expect(sections.map((section) => section.querySelector("h3")?.textContent)).toEqual([
      "Claude Code",
      "Cursor",
    ]);
    expect(sections[0]?.querySelector(".doctor-summary")?.classList.contains("doctor-ok")).toBe(
      true,
    );
    expect(sections[0]?.querySelectorAll(".doctor-check")).toHaveLength(1);
    expect(sections[0]?.querySelector(".doctor-counts")?.textContent).toContain("問題あり 0 件");
    expect(sections[0]?.querySelector("#doctor-original-claude pre")?.textContent).toBe(
      "Claude healthy",
    );
    expect(sections[1]?.querySelector(".doctor-summary")?.classList.contains("doctor-fail")).toBe(
      true,
    );
    expect(sections[1]?.querySelectorAll(".doctor-check")).toHaveLength(3);
    expect(sections[1]?.querySelector(".doctor-counts")?.textContent).toContain("問題あり 1 件");
    expect(sections[1]?.querySelector("#doctor-original-cursor pre")?.textContent).toBe(
      diagnosticReport.rawOutput,
    );
    expect(
      [...(sections[1]?.querySelectorAll("h4") ?? [])].map((heading) => heading.textContent),
    ).toEqual(["実行環境", "プロジェクト", "AI-DLC 本体"]);
    expect(view.doc.querySelectorAll("#doctor-original")).toHaveLength(0);
    expect(view.doc.querySelector("#run-doctor")?.textContent).toBe("診断を再実行");
    expect(view.setState).toHaveBeenLastCalledWith({
      log: "",
      status: "",
      doctorReport: null,
      doctorReports: reports,
    });
    view.dom.window.close();
  });

  it("restores grouped results and clears them on a new run or a single install result", () => {
    const reports = [{ id: "cursor", report: diagnosticReport }];
    const view = webview({ saved: { doctorReports: reports } });
    expect(view.doc.querySelectorAll(".doctor-tool")).toHaveLength(1);
    view.message({ type: "doctor-running" });
    expect(view.doc.querySelectorAll(".doctor-tool, .doctor-check")).toHaveLength(0);
    expect(view.doc.querySelector("#doctor-result")?.textContent).toBe("診断を実行しています。");
    expect(view.setState).toHaveBeenLastCalledWith({ log: "", status: "", doctorReport: null });
    view.message({
      type: "restore",
      log: "",
      text: "",
      doctorReport: null,
      doctorReports: reports,
    });
    expect(view.doc.querySelectorAll(".doctor-tool")).toHaveLength(1);
    view.message({ type: "doctor-report", report: diagnosticReport });
    expect(view.doc.querySelectorAll(".doctor-tool")).toHaveLength(0);
    expect(view.doc.querySelector("#doctor-original pre")?.textContent).toBe(
      diagnosticReport.rawOutput,
    );
    expect(view.setState.mock.lastCall?.[0].doctorReports).toBeUndefined();
    view.message({ type: "doctor-reports", reports });
    view.message({ type: "restore", log: "", text: "", doctorReport: null, doctorReports: [] });
    expect(view.doc.querySelector("#doctor-result")?.textContent).toBe(
      "診断はまだ実行していません。",
    );
    expect(view.setState).toHaveBeenLastCalledWith({ log: "", status: "", doctorReport: null });
    view.dom.window.close();
  });

  it("restores cached results but treats the host's restored report as authoritative", () => {
    const view = webview({ saved: { doctorReport: diagnosticReport, log: "cached log" } });
    expect(view.doc.querySelector("#doctor-result")?.textContent).toContain(
      diagnosticReport.summary,
    );
    view.message({ type: "restore", log: "", text: "", error: false, doctorReport: null });
    expect(view.doc.querySelector("#doctor-result")?.textContent).toBe(
      "診断はまだ実行していません。",
    );
    expect(view.doc.querySelector("#run-doctor")?.textContent).toBe("診断を実行");
    expect(view.setState).toHaveBeenLastCalledWith({ log: "", status: "", doctorReport: null });
    view.message({
      type: "restore",
      log: "log",
      text: "復元",
      error: false,
      doctorReport: diagnosticReport,
    });
    expect(view.doc.querySelectorAll(".doctor-check")).toHaveLength(3);
    expect(view.doc.querySelector("#doctor-original pre")?.textContent).toBe(
      diagnosticReport.rawOutput,
    );
    expect(view.doc.querySelector("#status")?.textContent).toBe("復元");
    view.dom.window.close();
  });

  it("runs diagnostics without an installed binary and suppresses repeat clicks while busy", () => {
    const view = webview();
    const button = view.doc.querySelector<HTMLButtonElement>("#run-doctor");
    expect(button?.disabled).toBe(false);
    button?.click();
    expect(view.postMessage).toHaveBeenLastCalledWith({
      type: "run-doctor",
      harnesses: ["cursor"],
    });
    view.message({ type: "doctor-report", report: diagnosticReport });
    view.message({ type: "busy", value: true });
    view.message({ type: "busy", value: true });
    view.message({ type: "doctor-running" });
    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toBe("診断中…");
    expect(view.doc.querySelector("#doctor")?.getAttribute("aria-busy")).toBe("true");
    expect(view.doc.querySelector("#doctor-result")?.textContent).toBe("診断を実行しています。");
    expect(view.doc.querySelector("#doctor-result time, .doctor-check")).toBeNull();
    const sent = view.postMessage.mock.calls.length;
    button?.click();
    view.doc.querySelector<HTMLButtonElement>("#recheck")?.click();
    expect(view.postMessage).toHaveBeenCalledTimes(sent);
    expect(view.setState.mock.lastCall?.[0].doctorReport).toBeNull();
    view.message({ type: "doctor-report", report: diagnosticReport });
    view.message({ type: "busy", value: false });
    expect(button?.disabled).toBe(false);
    expect(button?.textContent).toBe("診断を再実行");
    expect(view.doc.querySelector("#doctor")?.getAttribute("aria-busy")).toBe("false");
    expect(view.doc.querySelector<HTMLButtonElement>("#finish")?.disabled).toBe(true);
    view.dom.window.close();
    const untrusted = webview({ trusted: false });
    untrusted.message({ type: "busy", value: true });
    untrusted.message({ type: "busy", value: false });
    untrusted.doc.querySelector<HTMLButtonElement>("#run-doctor")?.click();
    expect(untrusted.postMessage).toHaveBeenCalledTimes(1);
    expect(untrusted.postMessage).toHaveBeenLastCalledWith({ type: "ready" });
    untrusted.dom.window.close();
  });
});
