# Feasibility & Constraints — 質問ファイル

> ステージ: feasibility (Ideation 1.3) / 深度: Standard  
> Intent: `260730-docs-i18n`  
> 入力: [intent-statement.md](../intent-capture/intent-statement.md)  
> 前提: 本プロジェクトはローカル専用（クラウド/AWS 不使用）。AWS 定型質問は不適用確認のみ。  
> 各質問の `[Answer]:` に選択肢の文字（複数可の場合はカンマ区切り）または自由記述を記入してください。

---

## Q1. 統合する既存システム

本機能が必ずつなぐ／延長する既存面はどれですか？（複数可）

- A. `packages/vscode-extension`（Webview docs UI・言語切替）
- B. 既存 docs-bridge / bridge-map（ナビ・用語補助として残す）
- C. `packages/dashboard`（StageCard 等からの深リンク）
- D. aidlc-workflows 同梱の `docs/guide` + `docs/reference` スナップショット取得経路
- E. A〜D すべてが初期スコープ
- X. その他（具体的に記入）

[Answer]: A,C

## Q2. 規制・コンプライアンス

公式 docs の同梱・翻訳・配布で守るべき要件はありますか？

- A. なし（社内ローカル拡張・公式公開ドキュメントの再配布のみ。特別な規制なし）
- B. ライセンス／帰属表示の遵守のみ（著作権表記・NOTICE を同梱）
- C. 社内情報管理ポリシーあり（どの docs を同梱してよいか承認が必要）
- D. 上記以外の規制（PCI / HIPAA / SOC2 / データレジデンシ等）がある — 具体的に記入
- X. その他（具体的に記入）

[Answer]: A

## Q3. 技術スタックとスキル

実装チームの前提として正しいものはどれですか？

- A. 既存 AIDLC Guide と同じ（TypeScript / bun / Vite / React / VS Code Extension API）で足りる
- B. A に加え、静的サイト生成や docs ツール（例: VitePress / Docusaurus / MDX）の新規導入が必要
- C. 翻訳ワークフロー用の追加ツール（例: 機械翻訳 API、i18n パイプライン）が必要
- D. スキルギャップあり — 具体的に記入（何が足りないか）
- X. その他（具体的に記入）

[Answer]: A

## Q4. 予算・タイムライン制約

実現の枠はどれに近いですか？

- A. 明確な締切なし。品質と運用可能性を優先
- B. 短サイクル（数日〜1–2 週間）で初期同梱（guide+reference）を出したい
- C. 翻訳完備より「en 同梱 + ja 部分 + 差分運用」の薄い縦スライスを先に出す
- D. 人員・時間が厳しく、スコープをさらに削る前提で進めたい
- X. その他（具体的に記入）

[Answer]: A

## Q5. 組織・運用上のブロッカー

進行を止めうる組織要因はありますか？

- A. なし。拡張リリースと翻訳 PR をこのリポジトリ内で回せる
- B. 翻訳レビュー担当の確保がボトルネックになりうる
- C. 変更凍結・他優先案件とぶつかりやすい
- D. upstream（aidlc-workflows）の docs 構造変更頻度が高く、追従コストが懸念
- X. その他（具体的に記入）

[Answer]: A

## Q6. AWS / クラウド（プロジェクト既定の確認）

project.md の既定どおり、本機能でもクラウド／AWS は使わずローカル同梱のみでよいですか？

- A. はい — 実行時 fetch なし。更新はリポジトリ／拡張リリース単位。AWS 観点は「インフラ不要・コストゼロ」で記録
- B. いいえ — 一部クラウド利用が必要（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A

## Q7. 同梱サイズと性能リスク

VSIX / 拡張起動への影響で、いま一番気になる制約はどれですか？

- A. guide+reference 程度なら許容。サイズ監視は後段 NFR でよい
- B. 初期からサイズ上限を決めたい（具体的な MB 目安を記入）
- C. 起動時間悪化が心配。遅延ロード必須前提で設計したい
- D. まだ不明。feasibility ではリスクとして記録し、計測は後段に回す
- X. その他（具体的に記入）

[Answer]: A

## Q8. 原文スナップショットの入手元

en 原文をどう取り込む想定ですか？

- A. このモノレポ内の upstream 追跡（既に docs がある／サブモジュールやコピー運用）
- B. 公開リポジトリからリリース時にスナップショットを取り込むスクリプト
- C. 手動でバージョンを指定して取り込む（自動化は後回し）
- D. 未定 — 選択肢を feasibility で比較してほしい
- X. その他（具体的に記入）

[Answer]: A

---

## Q9. Learnings (§13) — keep as project practices?

どれを `project.md` に残しますか？（複数可。A–E = c1–c5）

- A. c1 — AWS 定型質問は不適用。Q6 はローカル同梱確認のみ
- B. c2 — Q1=A,C は第一統合面。Docs Bridge 置き換えは破棄せず bridge-map は scope で任意
- C. c3 — Q8=A は「これからモノレポ内追跡を設ける」（現状未配置は I1/R1）
- D. c4 — AWS サービス列挙をローカル専用確認に置換した偏差
- E. c5 — Verdict を Conditional Go（I1 未解消）とした判断
- F. None — いずれも残さない
- X. その他（具体的に記入）

[Answer]: F

## Q10. Anything to add for next time?

- A. Nothing to add
- B. Add a note（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A
