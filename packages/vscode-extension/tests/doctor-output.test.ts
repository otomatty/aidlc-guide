import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDoctorOutput } from "../src/doctor-output.ts";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/doctor/${name}.txt`, import.meta.url), "utf8");
}

const healthy = fixture("v2.8.0-ok");
const warning = fixture("v2.8.1-warning");
const failed = fixture("v2.8.1-failed");
const executedAt = "2026-09-11T12:34:56.000Z";

function parse(stdout: string, code = 0, stderr = "", version = "2.8.1") {
  return parseDoctorOutput({ code, stdout, stderr }, version, executedAt);
}

describe("native doctor verbose report contract", () => {
  it("parses every row in a captured 2.8.0 report from an empty project", () => {
    const stdout = fixture("v2.8.0-source-empty-project");
    const result = parse(stdout, 1, "", "2.8.0");
    expect(result.outcome).toBe("failed");
    expect(result.checks).toHaveLength(48);
    expect(result.counts).toEqual({ passed: 44, warnings: 1, failed: 3 });
    expect(result.unparsedOutput).toEqual([]);
    expect(result.rawOutput).toBe(stdout);
  });

  it.each(["2.8.0", "2.8.1", "v2.8.0", "v2.8.1"])(
    "reads the supported %s report with Japanese labels and complete counts",
    (version) => {
      const result = parse(healthy, 0, "", version);
      expect(result).toMatchObject({
        version,
        executedAt,
        outcome: "ok",
        counts: { passed: 4, warnings: 0, failed: 0 },
        rawOutput: healthy,
        unparsedOutput: [],
      });
      expect(result.checks.map((check) => check.section)).toEqual([
        "machine",
        "project",
        "project",
        "framework",
      ]);
      expect(result.checks.every((check) => check.translated && /[ぁ-鿿]/.test(check.label))).toBe(
        true,
      );
      expect(result.summary).toBe("正常 4 件、要確認 0 件、問題あり 0 件です。");
    },
  );

  it("keeps advisory error findings as warnings and includes them in the footer count", () => {
    const result = parse(warning);
    expect(result.outcome).toBe("warning");
    expect(result.counts).toEqual({ passed: 3, warnings: 2, failed: 0 });
    expect(result.unparsedOutput).toEqual([]);
    expect(
      result.checks.find((check) => check.originalLabel.startsWith("[state-audit-drift]")),
    ).toMatchObject({ status: "warn", section: "project" });
    expect(result.checks.find((check) => check.originalLabel.startsWith("Plugins:"))).toMatchObject(
      { originalFix: "run `aidlc config`", fixTranslated: true },
    );
  });

  it.each([1, 2])("reports completed failing diagnostics despite exit code %i", (code) => {
    const result = parse(failed, code);
    expect(result.outcome).toBe("failed");
    expect(result.counts).toEqual({ passed: 3, warnings: 0, failed: 1 });
    expect(result.unparsedOutput).toEqual([]);
    expect(result.checks.find((check) => check.status === "fail")?.originalFix).toContain(
      "aidlc config --force",
    );
  });

  it("does not turn failing rows healthy when the process incorrectly exits zero", () => {
    expect(parse(failed).outcome).toBe("failed");
  });

  it("normalizes terminal color and CRLF for parsing while retaining exact raw output", () => {
    const decorated = healthy
      .replace("AI-DLC doctor", "\u001b[1mAI-DLC doctor\u001b[0m")
      .replaceAll("ok   ", "\u001b[32mok   \u001b[0m")
      .replaceAll("\n", "\r\n");
    const result = parse(decorated);
    expect(result.outcome).toBe("ok");
    expect(result.counts?.passed).toBe(4);
    expect(result.rawOutput).toBe(decorated);
  });

  it("preserves multiline remedies, unindented lines, Japanese paths, and HTML characters", () => {
    const remedy =
      "Inspect C:\\利用者\\日本語 & <project>\\.claude\\settings.json\n        Confirm hooks.\nRestart the IDE.";
    const result = parse(
      failed.replace(
        "run `aidlc config --force` to restore .claude/settings.json from the installed runtime",
        remedy,
      ),
      1,
    );
    expect(result.outcome).toBe("failed");
    const check = result.checks.find((item) => item.status === "fail");
    expect(check?.originalFix).toBe(remedy);
    expect(check?.fixTranslated).toBe(false);
    expect(check?.fix).toContain("日本語訳が未対応");
    expect(result.rawOutput).toContain(remedy);
  });

  it("retains unfamiliar checks with their actual status and a Japanese fallback", () => {
    const originalLabel = "Future scanner: C:\\作業\\<script> & config";
    const result = parse(healthy.replace("Models: recorded policy is expressible", originalLabel));
    expect(result.outcome).toBe("warning");
    expect(result.checks.find((check) => check.originalLabel === originalLabel)).toMatchObject({
      status: "ok",
      translated: false,
      label: expect.stringContaining("日本語訳が未対応"),
    });
    expect(result.summary).toContain("日本語訳が未対応");
  });

  it("never discards new status rows or unrelated output", () => {
    const extra = "  skip  Future feature";
    const result = parse(
      healthy.replace("\nFramework integrity", `\n${extra}\n\nFramework integrity`),
    );
    expect(result.outcome).toBe("warning");
    expect(result.unparsedOutput).toContain(extra);
    expect(result.summary).toContain("解析できない出力");
    expect(result.rawOutput).toContain(extra);
  });

  it("does not consume a new status row as part of the preceding remedy", () => {
    const extra = "  skip  Future feature";
    const result = parse(
      failed.replace("from the installed runtime\n", `from the installed runtime\n${extra}\n`),
      1,
    );
    expect(result.unparsedOutput).toContain(extra);
    expect(result.checks.find((check) => check.status === "fail")?.originalFix).not.toContain(
      extra,
    );
  });

  it("retains stderr separately and cannot report all healthy when stderr is unexpected", () => {
    const stderr = "A future diagnostic failed\nC:\\作業\\error.txt\n";
    const result = parse(healthy, 0, stderr);
    expect(result.outcome).toBe("warning");
    expect(result.rawOutput).toContain(healthy);
    expect(result.rawOutput).toContain(`[標準エラー出力]\n${stderr}`);
    expect(result.unparsedOutput).toContain(`[標準エラー出力]\n${stderr}`);
  });

  it.each(["2.8.2", "3.0.0", "2.8.1-beta.1", "", "unknown"])(
    "falls back to raw output for unsupported version %s",
    (version) => {
      const result = parse(healthy, 0, "", version);
      expect(result.outcome).toBe("unavailable");
      expect(result.counts).toBeNull();
      expect(result.checks).toEqual([]);
      expect(result.rawOutput).toBe(healthy);
      expect(result.unparsedOutput).toEqual([healthy]);
      expect(result.summary).toContain("日本語表示に対応していません");
    },
  );

  it.each([
    ["empty", ""],
    ["arbitrary success text", "All good"],
    ["no footer", healthy.split("0 problems")[0] ?? ""],
    ["missing section", healthy.replace("Machine\n", "")],
    ["sections out of order", healthy.replace("Machine\n", "Framework integrity\n")],
    ["duplicate section", healthy.replace("Machine\n", "Machine\nMachine\n")],
    ["missing remedy", failed.replace(/^ {8}fix:.*\n/m, "")],
    ["empty remedy", failed.replace(/^ {8}fix:.*$/m, "        fix:")],
    [
      "non-verbose aggregate",
      healthy.replace("Models: recorded policy is expressible", "all 4 checks passed"),
    ],
  ])("rejects %s reports as incomplete", (_name, stdout) => {
    const result = parse(stdout);
    expect(result.outcome).toBe("unavailable");
    expect(result.counts).toBeNull();
    expect(result.rawOutput).toBe(stdout);
    expect(result.summary).toContain("不完全");
  });

  it.each([
    warning.replace("0 problems, 2 warnings.", "0 problems, 1 warning."),
    failed.replace("1 problem, 0 warnings.", "0 problems, 0 warnings."),
  ])("rejects mismatched footer counts", (stdout) => {
    const result = parse(stdout);
    expect(result.outcome).toBe("unavailable");
    expect(result.counts).toBeNull();
    expect(result.summary).toContain("件数が一致しません");
  });

  it("distinguishes unsuccessful execution from a complete healthy report", () => {
    const result = parse(healthy, 127);
    expect(result.outcome).toBe("unavailable");
    expect(result.summary).toContain("終了コード 127");
  });

  it.each([
    ["timeout", "制限時間内"],
    ["spawn", "起動できません"],
    ["aborted", "中止しました"],
    ["buffer", "上限を超えた"],
    ["signal", "途中で終了"],
  ] as const)("explains %s failures even when partial results exist", (failure, message) => {
    const result = parseDoctorOutput({ code: 1, stdout: healthy, stderr: "", failure }, "2.8.1");
    expect(result.outcome).toBe("unavailable");
    expect(result.summary).toContain(message);
    expect(result.rawOutput).toBe(healthy);
    expect(result.checks).toHaveLength(4);
  });

  it("prioritizes startup failure over unavailable version information", () => {
    const result = parseDoctorOutput(
      { code: 1, stdout: "", stderr: "ENOENT", failure: "spawn" },
      "unknown",
    );
    expect(result.summary).toContain("起動できません");
    expect(result.rawOutput).toContain("ENOENT");
  });

  it.each(["x".repeat(2 * 1024 * 1024 + 1), "x\n".repeat(20_001)])(
    "bounds parsing work without discarding the original output",
    (stdout) => {
      const result = parse(stdout);
      expect(result.outcome).toBe("unavailable");
      expect(result.counts).toBeNull();
      expect(result.checks).toEqual([]);
      expect(result.rawOutput).toBe(stdout);
      expect(result.unparsedOutput).toEqual([stdout]);
    },
  );
});
