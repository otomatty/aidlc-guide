import { describe, expect, it } from "vitest";
import { buildComposeCommand, sanitizeComposeText } from "../src/compose-command.ts";

describe("sanitizeComposeText", () => {
  it("strips every shell-significant character", () => {
    expect(sanitizeComposeText('a "b" \'c\' `d` $e \\f %g% h!')).toBe("a b c d e f g h");
  });

  it("collapses whitespace and newlines", () => {
    expect(sanitizeComposeText("line1\nline2\t\tend  ")).toBe("line1 line2 end");
  });

  it("caps at 8000 chars", () => {
    expect(sanitizeComposeText("あ".repeat(9000)).length).toBe(8000);
  });

  it("keeps Japanese text intact", () => {
    expect(sanitizeComposeText("ログインのタイムアウトを直したい")).toBe(
      "ログインのタイムアウトを直したい",
    );
  });
});

describe("buildComposeCommand", () => {
  it("wraps the sanitized text in a single quoting level", () => {
    expect(buildComposeCommand("fix the login bug")).toBe(
      'claude "/aidlc compose fix the login bug"',
    );
  });

  it("returns null when nothing survives sanitisation", () => {
    expect(buildComposeCommand('"`$\\%!')).toBeNull();
    expect(buildComposeCommand("   ")).toBeNull();
  });

  // 否定テスト: 注入形が素通りしないこと。
  it("neutralises command-substitution and expansion attempts", () => {
    const cmd = buildComposeCommand('pwn" ; rm -rf ~ ; echo "$(whoami)`id`%PATH%!!');
    expect(cmd).not.toBeNull();
    for (const banned of ['\\"', "$(", "`", "%PATH%", "\\", "!"]) {
      expect(cmd?.includes(banned)).toBe(false);
    }
    // 外側の 2 個以外に引用符が存在しない。
    expect(cmd?.split('"').length).toBe(3);
    expect(cmd?.startsWith('claude "/aidlc compose ')).toBe(true);
  });
});
