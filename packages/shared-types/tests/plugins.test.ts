import { describe, expect, it } from "vitest";
import { parsePluginsPanelMessage } from "../src/plugins.ts";

describe("parsePluginsPanelMessage", () => {
  it("reads the messages the plugins page sends", () => {
    expect(parsePluginsPanelMessage({ type: "plugins-get" })).toEqual({ type: "plugins-get" });
    expect(parsePluginsPanelMessage({ type: "plugins-cancel", extra: 1 })).toEqual({
      type: "plugins-cancel",
    });
    expect(parsePluginsPanelMessage({ type: "plugins-action", action: "install", name: "focus" })).toEqual(
      { type: "plugins-action", action: "install", name: "focus" },
    );
    expect(parsePluginsPanelMessage({ type: "plugins-copy-start", name: "focus" })).toEqual({
      type: "plugins-copy-start",
      name: "focus",
    });
  });

  it("refuses anything else, so the host never acts on a malformed or foreign message", () => {
    for (const raw of [
      null,
      "plugins-get",
      { type: "plugins-action", action: "uninstall", name: "focus" },
      { type: "plugins-action", action: "install", name: "../focus" },
      { type: "plugins-action", action: "install", name: "Focus" },
      { type: "plugins-action", action: "install" },
      { type: "plugins-copy-start", name: 1 },
      { type: "open-workflows-install" },
    ])
      expect(parsePluginsPanelMessage(raw), JSON.stringify(raw)).toBeNull();
  });
});
