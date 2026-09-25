import type { OnboardingArea } from "@aidlc-guide/shared-types";

/**
 * One short tip per screen, shown on the first visit until closed. Each links
 * to the extension guide that explains the screen in full (docs/guides).
 */
export const AREA_TIPS: Record<OnboardingArea, { text: string; guide?: string }> = {
  home: {
    text: "「はじめに」と「更新情報」は、右上のメニューからいつでも開けます。",
  },
  stage: {
    text: "工程の目的・成果物・ゲート要求を確認できます。承認や修正の依頼は、AI-DLCを進めているチャットで伝えてください。",
    guide: "reading-workflow.md",
  },
  docs: {
    text: "公式ドキュメントと拡張機能のガイドを読めます。トップページの質問欄から、内蔵の文書をもとにAIへ質問することもできます。",
    guide: "asking-aidlc.md",
  },
  customization: {
    text: "開発ルール・ナレッジ・工程・エージェント・品質チェックを、フォームで編集すると自動保存します。保存には、カスタマイズに対応したAI-DLC本体が必要です。",
    guide: "customization.md",
  },
  effectiveness: {
    text: "案件ごとに、完了までの時間・承認待ち・差し戻し・品質チェックを比較できます。時間は記録からの推定で、人の実作業時間ではありません。",
    guide: "effectiveness.md",
  },
};
