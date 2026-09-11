import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import type { NativeDoctorReport } from "../src/doctor-output.ts";
import { setupHtml } from "../src/setup-html.ts";
import type { SetupSnapshot } from "../src/setup-state.ts";

vi.mock("../src/native-setup.ts", () => ({ SETUP_RELEASE: "test-release" }));

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

function webview(options: { trusted?: boolean; saved?: unknown } = {}) {
  const postMessage = vi.fn();
  const setState = vi.fn();
  const dom = new JSDOM(setupHtml(empty, "cursor", options.trusted ?? true, "testnonce"), {
    runScripts: "dangerously",
    beforeParse(window) {
      Object.assign(window, {
        acquireVsCodeApi: () => ({ postMessage, getState: () => options.saved ?? null, setState }),
      });
    },
  });
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
  it("renders tool selection and accessible steps, and sends the selected harness", () => {
    const postMessage = vi.fn();
    const dom = new JSDOM(setupHtml(empty, "cursor", true, "testnonce"), {
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
    const select = doc.querySelector<HTMLSelectElement>("#harness");
    if (!select) throw new Error("missing harness selector");
    select.value = "codex";
    select.dispatchEvent(new dom.window.Event("change"));
    expect(doc.querySelector("#start-command")?.textContent).toContain("$aidlc");
    doc.querySelector<HTMLButtonElement>("#install")?.click();
    expect(postMessage).toHaveBeenLastCalledWith({ type: "install", harness: "codex" });
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", { data: { type: "busy", value: true } }),
    );
    expect(doc.querySelector<HTMLButtonElement>("#install")?.disabled).toBe(true);
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", { data: { type: "busy", value: false } }),
    );
    expect(doc.querySelector<HTMLButtonElement>("#install")?.disabled).toBe(false);
    expect(doc.querySelector<HTMLButtonElement>("#finish")?.disabled).toBe(true);
    dom.window.close();
  });
  it("escapes workspace and version content and uses a nonce-only script policy", () => {
    const html = setupHtml(
      { ...empty, root: '</code><script>alert("x")</script>', version: "<img src=x>" },
      "claude",
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
      const dom = new JSDOM(setupHtml({ ...empty, configured: true }, "cursor", trusted, "nonce"));
      expect(dom.window.document.querySelector<HTMLButtonElement>("#finish")?.disabled).toBe(
        !trusted,
      );
      expect(dom.window.document.querySelector<HTMLButtonElement>("#register-mcp")?.disabled).toBe(
        !trusted,
      );
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
    expect(view.postMessage).toHaveBeenLastCalledWith({ type: "run-doctor", harness: "cursor" });
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
