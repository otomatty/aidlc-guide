import type { WhatsNewEntry } from "./onboarding.ts";

/**
 * AIDLC Guide's own user-facing changes, newest first, shown in the 更新情報
 * sheet and announced after an update.
 *
 * Entries are keyed by id and date rather than by version: the release
 * version is assigned after merge by the bump workflow, so the author of a
 * change cannot know it. Add an entry in the same pull request as the change
 * (docs/maintenance/release-and-sync.md, 「更新情報を書く」); a release:minor
 * or release:major PR that leaves this file alone fails the release-labels
 * check. Never rename or reuse a shipped id — stored seen-sets refer to it.
 */
export const WHATS_NEW: readonly WhatsNewEntry[] = [
  {
    id: "onboarding",
    date: "2026-09-25",
    title: "はじめにページと更新情報を追加しました",
    body: "右上のメニューから「はじめに」と「更新情報」を開けます。はじめにでは主な画面の見方を紹介し、実際の画面を順に案内するツアーも始められます。",
    action: { label: "はじめにを開く", target: "welcome" },
    spotlight: {
      area: "home",
      text: "右上のメニューに「はじめに」と「更新情報」を追加しました。画面の見方をいつでも確認できます。",
    },
  },
  {
    id: "docs-chat",
    date: "2026-09-25",
    title: "ドキュメントへの質問を会話で続けられます",
    body: "「ドキュメント」の質問欄で、前の回答を踏まえて続けて質問できます。会話はこのマシンに保存され、パネルを開き直しても続きから読めます。",
    action: { label: "ドキュメントを開く", target: "docs" },
    spotlight: {
      area: "docs",
      text: "質問欄が会話形式になりました。前の回答を踏まえて続けて質問できます。",
    },
  },
  {
    id: "workflows-2-10",
    date: "2026-09-24",
    title: "aidlc-workflows 2.10.0 に対応しました",
    body: "同梱ドキュメントと、インストール・更新の導入先を 2.10.0 にそろえました。主な変更は「ドキュメント」の更新のハイライトで確認できます。",
    action: { label: "ドキュメントを開く", target: "docs" },
  },
  {
    id: "stage-detail-tabs",
    date: "2026-09-24",
    title: "ステージ詳細を「概要」と「時間」のタブに分けました",
    body: "工程の説明と時間の内訳をタブで切り替えられます。前後の工程へは、パネル上部の矢印で移動します。",
    action: { label: "ステージ一覧を開く", target: "home" },
  },
  {
    id: "newest-intents-first",
    date: "2026-09-24",
    title: "インテントを新しい順に並べました",
    body: "インテントの一覧と効果測定の一覧を新しい順に表示し、最近の作業を見つけやすくしました。",
  },
  {
    id: "update-repair-ai",
    date: "2026-09-23",
    title: "更新できない設定の競合を AI で解消できます",
    body: "更新画面で設定の競合が見つかったとき、「AIで修正して更新」から修正と更新をまとめて進められます。診断は画面を開くと自動で始まります。",
    action: { label: "設定を開く", target: "settings" },
  },
];
