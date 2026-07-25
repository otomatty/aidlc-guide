# Security Requirements — Unit: dashboard-ui

> nfr-requirements (3.2) / Unit: dashboard-ui / 2026-07-24
> 入力: functional-design/business-rules.md（BR-UI-1/7）+ requirements.md（NFR-1/7）+ Mob モード前提

## 要件

| ID | 要件 | 検証 |
|----|------|------|
| S-UI-1 | **書込 UI を持たない**（本 Unit は read-only。AnswerEditor は artifact-viewer Unit — BR-UI-7）。POST を発行するコードがゼロ | import/呼出走査 |
| S-UI-2 | **FS アクセスなし**（reader-core を import しない — BR-UI-1）。ブラウザからのデータ取得は同一オリジンの /api のみ | import 走査 |
| S-UI-3 | **成果物本文をそのまま DOM に挿入しない**（本 Unit は解説カード = 構造化フィールドのみ表示。Markdown レンダリングは artifact-viewer Unit の責務）。`dangerouslySetInnerHTML` を本 Unit で使わない | lint ルール |
| S-UI-4 | docs deep-link の遷移先はローカル docs パス or 設定された URL のみ（docs-bridge 由来）。ユーザー入力由来の URL を開かない | リンク生成の検査 |
| S-UI-5 | Mob モード（LAN 公開）時、UI に機微情報の追加露出を作らない（表示するのはサーバが返す範囲のみ — サーバ側が唯一の露出境界） | 設計検査 |

## 非該当

認証・トークン・Cookie を扱わない（サーバに認証なし — スコープ外）。同一オリジン配信のため CORS 設定なし。
