import { describe, expect, it, vi } from "vitest";
import { applyReleaseFromUrl } from "../src/release-apply.ts";

function vsixBytes(): Uint8Array {
  const bytes = new Uint8Array(120);
  bytes[0] = 0x50;
  bytes[1] = 0x4b;
  return bytes;
}

describe("applyReleaseFromUrl", () => {
  it("writes, installs, and cleans up a valid VSIX", async () => {
    const bytes = vsixBytes();
    const writeBytes = vi.fn(async () => "/tmp/aidlc-guide-0.2.0.vsix");
    const installFromPath = vi.fn(async () => undefined);
    const cleanupPath = vi.fn(async () => undefined);
    const result = await applyReleaseFromUrl("0.2.0", "https://example.invalid/app.vsix", {
      fetchImpl: async () => new Response(bytes, { status: 200 }),
      writeBytes,
      installFromPath,
      cleanupPath,
    });
    expect(result).toEqual({ ok: true });
    expect(writeBytes).toHaveBeenCalledWith("0.2.0", bytes);
    expect(installFromPath).toHaveBeenCalledWith("/tmp/aidlc-guide-0.2.0.vsix");
    expect(cleanupPath).toHaveBeenCalledWith("/tmp/aidlc-guide-0.2.0.vsix");
  });

  it("rejects a non-VSIX payload and does not install", async () => {
    const installFromPath = vi.fn(async () => undefined);
    const result = await applyReleaseFromUrl("0.2.0", "https://example.invalid/app.vsix", {
      fetchImpl: async () => new Response(new Uint8Array(120), { status: 200 }),
      writeBytes: async () => "/tmp/x.vsix",
      installFromPath,
      cleanupPath: async () => undefined,
    });
    expect(result).toEqual({ ok: false, reason: "invalid-vsix" });
    expect(installFromPath).not.toHaveBeenCalled();
  });

  it("maps install failure after cleanup", async () => {
    const cleanupPath = vi.fn(async () => undefined);
    const result = await applyReleaseFromUrl("0.2.0", "https://example.invalid/app.vsix", {
      fetchImpl: async () => new Response(vsixBytes(), { status: 200 }),
      writeBytes: async () => "/tmp/x.vsix",
      installFromPath: async () => {
        throw new Error("no");
      },
      cleanupPath,
    });
    expect(result).toEqual({ ok: false, reason: "install" });
    expect(cleanupPath).toHaveBeenCalled();
  });
});
