import { describe, expect, it } from "vitest";
import {
  explainChangeControl,
  explainDepth,
  explainDone,
  explainGate,
  explainNowFields,
  explainPhase,
  explainScope,
  explainStage,
} from "@/chrome/now-strip-explain.ts";
import { workflow } from "@tests/fixtures.ts";

describe("now-strip-explain", () => {
  it("uses the same work-time term as the elapsed label", () => {
    expect(explainNowFields(workflow(), null).elapsed.definition).toBe(
      "監査ログから算出した作業時間です。対応付けられる承認待ち・中断を分け、設定されたしきい値を超えるログ空白を除外します。",
    );
  });
  it("labels Change Control as a record and explains memory precedence", () => {
    const result = explainChangeControl(
      workflow({ changeControl: { value: "relaxed", source: "from scope mvp" } }),
    );
    expect(result.current).toContain("relaxed（設定元: from scope mvp）");
    expect(result.definition).toContain("状態ファイルの記録");
    expect(result.bullets.join(" ")).toContain("実行時はその設定が優先");
    expect(
      explainChangeControl(workflow({ changeControl: { value: "strict", source: null } })).current,
    ).toContain("設定元の記録なし");
  });

  it("distinguishes absent and unreadable Change Control", () => {
    expect(explainChangeControl(workflow()).current).toContain("未記録");
    expect(
      explainChangeControl(workflow({ unparseable: { changeControl: "unknown" } })).current,
    ).toContain("解析できません");
  });
  it("explains each phase with a current-value meaning", () => {
    const explain = explainPhase("CONSTRUCTION");
    expect(explain.definition).toMatch(/大区分/);
    expect(explain.current).toMatch(/構築/);
    expect(explain.bullets.length).toBeGreaterThanOrEqual(2);
  });

  it("explains a missing current stage", () => {
    expect(explainStage(null).current).toMatch(/ありません/);
    expect(explainStage("code-generation").current).toContain("code-generation");
  });

  it("names the selected scope in the current meaning", () => {
    expect(explainScope("prd-implementation").current).toContain("prd-implementation");
  });

  it("maps known depths case-insensitively", () => {
    expect(explainDepth("Standard").current).toMatch(/標準/);
    expect(explainDepth("minimal").current).toMatch(/最小限/);
  });

  it("explains gate statuses and the null case", () => {
    expect(explainGate(null).current).toMatch(/ありません/);
    expect(explainGate("awaiting-approval").current).toMatch(/awaiting approval/);
  });

  it("explains the done/total progress pair", () => {
    expect(explainDone(3, 6).current).toContain("3 / 6");
    expect(explainDone(0, 0).current).toMatch(/0/);
  });
});
