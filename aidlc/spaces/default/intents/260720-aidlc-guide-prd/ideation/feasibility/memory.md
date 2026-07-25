<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is maintained by the orchestrator during stage execution. Add observations at the gate ritual, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-07-20T15:58:42Z — ローカル専用ツールのためAWS定型質問（利用サービス・アカウント）は不適用と判断し質問から除外; AWSプラットフォーム観点は「インフラ不要・コストゼロの確認」として成果物に記載
- 2026-07-20T15:58:42Z — Q4回答（Live Share使用可）によりPRD §11の該当リスクをRAIDでClosed扱いにした

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-07-20T15:58:42Z — ステージ定義の定型質問（既存システム統合・規制・予算）のうち規制はコンプライアンススキャンで「該当なし」を確認して質問を省略; 社内ツールで明白なため

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-07-20T15:58:42Z — バージョン互換は現行限定（Q1=A）を採用; 防御的多版パーサ（C案）は工数増に見合わない。State Version検知 + 解析不可表示で将来変更に耐える

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-07-20T15:58:42Z — tb-lxpフィクスチャの具体的なリポジトリURL/パスが未確定（A-2）; M1開始時（code-generation前）までに確認が必要
