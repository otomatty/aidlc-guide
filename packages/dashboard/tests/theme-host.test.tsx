import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "../src/components/ThemeToggle.tsx";
import { StoreProvider } from "../src/store/context.tsx";
import {
  applyVsCodeHost,
  isVsCodeDarkBody,
  isVsCodeWebview,
  syncVsCodeTheme,
  watchVsCodeTheme,
} from "../src/theme/host.ts";

describe("isVsCodeWebview", () => {
  it("is true when acquireVsCodeApi is a function", () => {
    expect(isVsCodeWebview({ acquireVsCodeApi: () => ({}) })).toBe(true);
  });

  it("is false in a plain browser window", () => {
    expect(isVsCodeWebview({})).toBe(false);
  });
});

describe("isVsCodeDarkBody", () => {
  it("reads vscode-dark / high-contrast classes", () => {
    const body = document.createElement("body");
    body.className = "vscode-light";
    expect(isVsCodeDarkBody(body)).toBe(false);

    body.className = "vscode-dark";
    expect(isVsCodeDarkBody(body)).toBe(true);

    body.className = "vscode-high-contrast";
    expect(isVsCodeDarkBody(body)).toBe(true);

    body.className = "vscode-high-contrast-light";
    expect(isVsCodeDarkBody(body)).toBe(false);
  });
});

describe("applyVsCodeHost / syncVsCodeTheme", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-host");
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
    document.body.className = "";
  });

  it("sets data-host and mirrors body theme onto html", () => {
    document.body.className = "vscode-dark";
    applyVsCodeHost(document.documentElement);
    expect(document.documentElement.getAttribute("data-host")).toBe("vscode");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    document.body.className = "vscode-light";
    syncVsCodeTheme(document.documentElement);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("watchVsCodeTheme updates when the body class changes", async () => {
    document.body.className = "vscode-light";
    const stop = watchVsCodeTheme();
    expect(document.documentElement.getAttribute("data-host")).toBe("vscode");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    document.body.className = "vscode-dark";
    await vi.waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    stop();
  });
});

describe("ThemeToggle in VS Code webview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute("data-host");
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
    document.body.className = "";
  });

  it("hides the toggle and follows the editor theme", () => {
    document.body.className = "vscode-dark";
    vi.stubGlobal("acquireVsCodeApi", () => ({}));

    render(
      <StoreProvider>
        <ThemeToggle />
      </StoreProvider>,
    );

    expect(screen.queryByTestId("theme-toggle")).toBeNull();
    expect(document.documentElement.getAttribute("data-host")).toBe("vscode");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
