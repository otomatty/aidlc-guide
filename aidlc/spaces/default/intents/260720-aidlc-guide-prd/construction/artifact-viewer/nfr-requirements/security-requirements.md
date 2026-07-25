# Security Requirements — Unit: artifact-viewer

> nfr-requirements (3.2) / Unit: artifact-viewer / 2026-07-25
> 入力: functional-design（D2 の書込境界・hostMode）+ requirements.md（NFR-1/7, FR-6.2）+ dashboard-server の 5ゲート契約

## 要件

| ID | 要件 | 検証 |
|----|------|------|
| S-AV-1 | **書込は POST /api/answer の1経路のみ**（他の書込 API を呼ばない）。クライアントは `{file, line, value}` 契約に従う | 呼出走査 |
| S-AV-2 | **hostMode 時は編集 UI を DOM に描画しない**（`serverMode.hostMode === true` で AnswerEditor 自体を返さない — US-11 の DOM 不在要件）。サーバ 403 は最終防衛線であり UI 抑止と二重 | RTL で DOM 不在を検証 |
| S-AV-3 | **成果物 Markdown を信頼しない**: 描画は Markdown レンダラ経由のみで、生 HTML を素通ししない（Milkdown/代替の HTML 埋め込みを無効化。`dangerouslySetInnerHTML` を本 Unit で使わない） | lint + 悪意ある HTML を含む fixture |
| S-AV-4 | **Mermaid の入力もサニタイズ対象**（mermaid の `securityLevel: "strict"` 相当を設定。クリックイベント/スクリプトを無効化） | 設定検査 + 悪意 fixture |
| S-AV-5 | 保存前後のバイト比較でユーザーに見せるのは差分の有無のみ（他行の内容をエラーメッセージに載せない） | エラーパステスト |

## 脅威メモ

本 Unit は**唯一「外部由来の文書を描画する」場所**。aidlc 成果物は自チームが書いたものだが、モブでユーザーが貼り付けた内容を含み得る（LAN 公開時は不特定の閲覧者に届く）。したがって Markdown/Mermaid の HTML・スクリプト経路を塞ぐこと（S-AV-3/4）が本 Unit の主要なセキュリティ責務。
