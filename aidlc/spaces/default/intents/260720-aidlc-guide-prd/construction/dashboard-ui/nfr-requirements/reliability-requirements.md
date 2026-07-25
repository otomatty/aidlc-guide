# Reliability Requirements — Unit: dashboard-ui

> nfr-requirements (3.2) / Unit: dashboard-ui / 2026-07-24
> 入力: functional-design（5状態・エラーハンドリング・再接続）+ requirements.md（NFR-6）+ a11y checklist

## 要件

| ID | 要件 | 検証 |
|----|------|------|
| R-UI-1 | **全画面クラッシュゼロ**: 領域単位 ErrorBoundary。どの領域が落ちても他は表示継続（BR-UI-5/NFR-6） | 例外注入テスト（各領域） |
| R-UI-2 | **縮退の可視化**: unsupported/error/warnings/cell.error が必ず UI 要素として現れる（黙って空表示にしない — BR-UI-4） | 縮退ペイロードのレンダリングテスト |
| R-UI-3 | **サーバ停止時の明示**: fetch/WS 失敗で「サーバに接続できません」+ 再試行導線。白画面禁止 | オフラインテスト |
| R-UI-4 | **WS 自動再接続**: 指数バックオフ（1s→最大10s）。再接続成功で REST 再取得し整合回復（サーバは状態を持たない前提） | 切断・再接続テスト |
| R-UI-5 | **ライブ性喪失の明示**: live-status degraded で LiveStatus が「更新が止まっています」を表示（aria-live） | メッセージテスト |
| R-UI-6 | 決定性: 同一データで同一描画（順序はサーバ由来配列を保持し UI でソートし直さない — BR-UI-3 の精神） | スナップショットテスト |

## a11y の信頼性側面

キーボードのみで全機能到達可能（a11y checklist 2.1.1）— これが満たされない状態は「壊れている」と扱う（手動走査を受入条件に含める）。
