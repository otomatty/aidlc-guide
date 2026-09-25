import type { NextGateEstimate } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import {
  explainGuardPolicy,
  explainDepth,
  explainDone,
  explainGate,
  explainNextGate,
  explainNowFields,
  explainPhase,
  explainScope,
  explainStage,
} from "@/shell/now-strip/now-strip-explain.ts";
import { workflow } from "@tests/fixtures.ts";

describe("now-strip-explain", () => {
  it("uses the same work-time term as the elapsed label", () => {
    expect(explainNowFields(workflow(), null).elapsed.definition).toBe(
      "監査ログから算出した作業時間です。対応付けられる承認待ち・中断を分け、設定されたしきい値を超えるログ空白を除外します。",
    );
  });
  it("labels Guard Policy as a record and explains memory precedence", () => {
    const result = explainGuardPolicy(
      workflow({ guardPolicy: { value: "relaxed", source: "from scope mvp" } }),
    );
    expect(result.current).toContain("relaxed（設定元: from scope mvp）");
    expect(result.definition).toContain("状態ファイルの記録");
    expect(result.bullets.join(" ")).toContain("実行時はその設定が優先");
    expect(
      explainGuardPolicy(workflow({ guardPolicy: { value: "strict", source: null } })).current,
    ).toContain("設定元の記録なし");
  });

  it("distinguishes absent and unreadable Guard Policy", () => {
    expect(explainGuardPolicy(workflow()).current).toContain("未記録");
    expect(
      explainGuardPolicy(workflow({ unparseable: { guardPolicy: "unknown" } })).current,
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

  describe("next approval gate", () => {
    const gate = (over: Partial<NextGateEstimate> = {}): NextGateEstimate => ({
      kind: "stage",
      stage: "code-generation",
      remainingMs: 2_700_000,
      stages: ["code-generation"],
      autoApproved: [],
      planApproval: false,
      lowConfidence: false,
      estimateCoverage: { known: 1, unknown: 0 },
      ...over,
    });

    it("describes a work amount, not a clock time", () => {
      const explain = explainNowFields(workflow(), null, gate()).nextGate;
      expect(explain.definition).toContain("承認ゲート");
      expect(explain.bullets[0]).toContain("完了時刻ではなく作業量");
      expect(explainNowFields(workflow(), null).nextGate.current).toContain("算出できません");
    });

    it("says where each kind of gate falls and how much work is before it", () => {
      expect(explainNextGate(gate({ kind: "open", remainingMs: 0, stages: [] })).current).toContain(
        "「code-generation」の承認ゲートが開いています",
      );
      const stage = explainNextGate(gate()).current;
      expect(stage).toContain("「code-generation」の作業が終わると承認を求められます");
      expect(stage).toContain("約 45m");
      expect(
        explainNextGate(gate({ kind: "block", stage: "functional-design" })).current,
      ).toContain("すべての Unit");
      expect(explainNextGate(gate({ kind: "unit" })).current).toContain("この値より早く");
      expect(
        explainNextGate(gate({ kind: "none", stage: null, remainingMs: 0, stages: [] })).current,
      ).toBe("残りのステージに承認ゲートはありません。");
      expect(
        explainNextGate(gate({ kind: "none", stage: null, stages: ["build-and-test"] })).current,
      ).toContain("完了までの残り作業は約 45m");
      expect(explainNextGate(gate({ remainingMs: null })).current).toContain(
        "作業量は推定できません",
      );
    });

    it("lists auto-approved stages, the Plan Approval stop and unknown parts", () => {
      const bullets = explainNextGate(
        gate({
          autoApproved: ["build-and-test", "ci-pipeline"],
          planApproval: true,
          estimateCoverage: { known: 1, unknown: 2 },
        }),
      ).bullets.join(" ");
      expect(bullets).toContain("承認なしで進むステージ: build-and-test、ci-pipeline");
      expect(bullets).toContain("計画承認");
      expect(bullets).toContain("推定できない 2 工程");
    });

    it("leaves out the unknown-parts note when there is no sum to qualify", () => {
      const bullets = explainNextGate(
        gate({ remainingMs: null, estimateCoverage: { known: 0, unknown: 2 } }),
      ).bullets.join(" ");
      expect(bullets).not.toContain("推定できない");
    });

    it("names the walking skeleton record as a gate source", () => {
      expect(explainNextGate(gate()).bullets.join(" ")).toContain("walking skeleton");
    });
  });
});
