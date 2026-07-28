import type { Phase, StageStatus, TimingsPayload, WorkflowModel } from "@aidlc-guide/shared-types";
import { formatDuration } from "@aidlc-guide/shared-types";
import { STATUS_PRESENTATION } from "./StatusChip.tsx";

/** Content for a Now-strip HoverCard: definition + current value + short bullets. */
export interface FieldExplain {
  definition: string;
  current: string;
  bullets: readonly string[];
}

const PHASE_MEANING: Record<Phase, string> = {
  INITIALIZATION: "ワークスペースと最初のインテントを用意する立ち上げ段階です。",
  IDEATION: "何を作るか・なぜ作るかを固める構想段階です。",
  INCEPTION: "要件・設計・計画に落とし込む準備段階です。",
  CONSTRUCTION: "ユニット単位で設計・実装・検証を進める構築段階です。",
  OPERATION: "出荷後の性能・運用・改善を扱う運用段階です。",
};

const DEPTH_MEANING: Record<string, string> = {
  minimal: "成果物を最小限に抑えた深さです。すばやく進める用途向け。",
  standard: "標準的な成果物の深さです。多くのスコープの既定値。",
  comprehensive: "網羅的な成果物を求める深さです。重い検証や文書化向け。",
};

function depthKey(raw: string): string {
  return raw.trim().toLowerCase();
}

export function explainPhase(phase: Phase): FieldExplain {
  return {
    definition: "ライフサイクル上の大区分です。ステージはこのフェーズの下に並びます。",
    current: PHASE_MEANING[phase],
    bullets: [
      "順に INITIALIZATION → IDEATION → INCEPTION → CONSTRUCTION → OPERATION",
      "Now strip の値は aidlc-state.md の Lifecycle Phase",
      "フェーズを跨ぐ進行はエンジン（/aidlc）が担当",
    ],
  };
}

export function explainStage(currentStage: string | null): FieldExplain {
  return {
    definition: "ワークフローグラフ上の作業単位です。1ステージが成果物・質問・ゲートを持ちます。",
    current:
      currentStage === null
        ? "現在ステージはありません（未開始、またはワークフロー完了）。"
        : `いまの作業点は「${currentStage}」です。ここで求められる承認や記入が進みます。`,
    bullets: [
      "Stage rail で前後のステージ一覧を確認できる",
      "クリックでそのステージの解説・成果物へ進める",
      "進行・SKIP の判定は選択中スコープに従う",
    ],
  };
}

export function explainScope(scope: string): FieldExplain {
  return {
    definition: "どのステージを EXECUTE / SKIP するかを決める実行プランの名前です。",
    current: `選択中は「${scope}」。.claude/scopes/ の定義に従い in-scope ステージが決まります。`,
    bullets: [
      "例: mvp / feature / prd-implementation / enterprise",
      "変更は /aidlc --scope <name>（承認ゲートあり）",
      "スコープが Stage rail の並びと完了分母を決める",
    ],
  };
}

export function explainDepth(depth: string): FieldExplain {
  const key = depthKey(depth);
  return {
    definition: "各ステージで求める成果物の詳しさ（深さ）です。",
    current: DEPTH_MEANING[key] ?? `いまの Depth は「${depth}」です。`,
    bullets: [
      "取りうる値: Minimal / Standard / Comprehensive",
      "スコープの既定値を /aidlc --depth で上書きできる",
      "Test Strategy とは別（テスト量は別フィールド）",
    ],
  };
}

export function explainGate(gate: StageStatus | null): FieldExplain {
  if (gate === null) {
    return {
      definition: "人間の承認が必要な止まり所です。ゲート中は次ステージへ進みません。",
      current: "ゲート状態はありません（現在ステージなし、または未適用）。",
      bullets: [
        "典型は awaiting approval（承認待ち）",
        "承認・差し戻しは aidlc-workflows 本体側の操作",
        "この Dashboard は状態の可視化が主目的",
      ],
    };
  }
  const { label } = STATUS_PRESENTATION[gate];
  return {
    definition: "人間の承認が必要な止まり所です。ゲート中は次ステージへ進みません。",
    current: `現在ステージの状態は「${label}」です。`,
    bullets: [
      "awaiting approval = 成果物を確認して承認する番",
      "revising = 差し戻し後の再作業中",
      "承認操作は /aidlc セッション側（Guide は読み取り中心）",
    ],
  };
}

export function explainDone(done: number, total: number): FieldExplain {
  return {
    definition: "スコープ内ステージの進捗カウントです（完了数 / 総数）。",
    current:
      total === 0
        ? "総数が 0 です（スコープまたは state を確認してください）。"
        : `${done} / ${total} — 完了（と SKIP 計上）が ${done}、分母は in-scope 総数 ${total}。`,
    bullets: [
      "分母は aidlc-state.md の Total Stages（なければ EXECUTE 行数）",
      "分子は Completed、または [x] と [S] の合計",
      "残りは Stage rail の未完了・進行中として見える",
    ],
  };
}

function explainElapsed(elapsedActiveMs: number | null): FieldExplain {
  return {
    definition:
      "現在のステージが始まってからの実作業時間の推定です。10分を超える無操作は待ち時間として差し引いています。",
    current:
      elapsedActiveMs === null
        ? "まだ所要時間を算出できていません（実行中のステージがないか、監査ログを読めていません）。"
        : `いまのステージにこれまで約 ${formatDuration(elapsedActiveMs)} を費やしています。`,
    bullets: [
      "壁時計の経過時間ではありません — 離席や夜間の中断は含めていません",
      "監査ログのイベント間隔から算出しています",
      "10分を超える無音の生成は10分として数えられます",
    ],
  };
}

function explainRemaining(remainingMs: number | null, lowConfidence: boolean): FieldExplain {
  return {
    definition: "同じステージの過去の実績（中央値）から見た、残りの実作業量の推定です。",
    current:
      remainingMs === null
        ? "推定に使える実績がまだありません。"
        : `残り約 ${formatDuration(remainingMs)} の作業量です${lowConfidence ? "（実績が少ないため参考値）" : ""}。`,
    bullets: [
      "完了時刻ではなく作業量です — いつ終わるかは着手のタイミング次第です",
      "実績が1件のみの場合は前回の値そのものです",
      "実績のないステージは同じフェーズの中央値で代用します",
      "同じフェーズにも実績がなければ、ワークスペース全体の中央値で代用します",
    ],
  };
}

export function explainNowFields(
  workflow: WorkflowModel,
  timings: TimingsPayload | null,
): {
  phase: FieldExplain;
  stage: FieldExplain;
  scope: FieldExplain;
  depth: FieldExplain;
  gate: FieldExplain;
  done: FieldExplain;
  elapsed: FieldExplain;
  remaining: FieldExplain;
} {
  return {
    phase: explainPhase(workflow.phase),
    stage: explainStage(workflow.currentStage),
    scope: explainScope(workflow.scope),
    depth: explainDepth(workflow.depth),
    gate: explainGate(workflow.gate),
    done: explainDone(workflow.done, workflow.total),
    elapsed: explainElapsed(timings?.remaining.currentStage?.elapsedActiveMs ?? null),
    remaining: explainRemaining(
      timings?.remaining.currentStage?.remainingMs ?? null,
      timings?.remaining.lowConfidence ?? false,
    ),
  };
}
