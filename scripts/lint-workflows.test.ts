import { describe, expect, it } from "vitest";
import {
  assetFor,
  tarExecutable,
  validateConcurrencyQueues,
  verifyChecksum,
} from "./lint-workflows";

describe("actionlint download boundary", () => {
  it("rejects a modified archive before extraction or execution", () => {
    const digest = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    expect(() => verifyChecksum(new TextEncoder().encode("abd"), digest)).toThrow(
      "SHA-256 mismatch",
    );
    expect(() => verifyChecksum(new TextEncoder().encode("abc"), digest)).not.toThrow();
  });

  it("uses Windows bsdtar so the actionlint zip extracts", () => {
    expect(tarExecutable("win32", "D:\\Windows")).toBe("D:\\Windows\\System32\\tar.exe");
    expect(tarExecutable("linux")).toBe("tar");
  });

  it("refuses unsupported platforms instead of falling back to an arbitrary binary", () => {
    expect(() => assetFor("linux", "riscv64")).toThrow("unsupported platform");
    expect(() => assetFor("freebsd", "x64")).toThrow("unsupported platform");
  });

  it.each([
    ["win32", "x64", "windows_amd64.zip"],
    ["win32", "arm64", "windows_arm64.zip"],
    ["darwin", "arm64", "darwin_arm64.tar.gz"],
    ["darwin", "x64", "darwin_amd64.tar.gz"],
    ["linux", "x64", "linux_amd64.tar.gz"],
    ["linux", "arm64", "linux_arm64.tar.gz"],
  ])("has a pinned archive for %s/%s", (platform, arch, suffix) => {
    const asset = assetFor(platform, arch);
    expect(asset.name.endsWith(suffix)).toBe(true);
    expect(asset.checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("concurrency.queue compatibility check", () => {
  it("rejects invalid queue values at workflow and job scope", () => {
    expect(() => validateConcurrencyQueues({ concurrency: { queue: "typo" } })).toThrow(
      "single or max",
    );
    expect(() =>
      validateConcurrencyQueues({ jobs: { release: { concurrency: { queue: 100 } } } }),
    ).toThrow("single or max");
  });

  it("rejects cancellation that would conflict with preserving queued releases", () => {
    expect(() =>
      validateConcurrencyQueues({ concurrency: { queue: "max", "cancel-in-progress": true } }),
    ).toThrow("cancel-in-progress");
  });

  it("accepts GitHub's valid queue settings and ordinary concurrency", () => {
    expect(() =>
      validateConcurrencyQueues({
        concurrency: { group: "release", queue: "max", "cancel-in-progress": false },
        jobs: { check: { concurrency: { group: "check", queue: "single" } } },
      }),
    ).not.toThrow();
    expect(() => validateConcurrencyQueues({ concurrency: "plain-group" })).not.toThrow();
  });
});
