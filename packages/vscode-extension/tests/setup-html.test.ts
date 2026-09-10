import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { setupHtml } from "../src/setup-html.ts";
import type { SetupSnapshot } from "../src/setup-state.ts";

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
      dom.window.close();
    }
  });
});
