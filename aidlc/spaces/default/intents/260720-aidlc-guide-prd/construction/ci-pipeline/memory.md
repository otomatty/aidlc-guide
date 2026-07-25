<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is maintained by the orchestrator during stage execution. Add observations at the gate ritual, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-07-26T00:00:00Z — ステージ標準の質問（CodePipeline / ECR / CodeArtifact 等）を出さず、本プロジェクト固有の実質的判断（CI の形・git 初期化）だけを問うた。適用されない選択肢を形式的に並べると、回答者が「無い」と答える作業だけが増える
- 2026-07-26T00:00:00Z — ゲートの定義をフックにも workflow にも書かず、両者が `bun run check` を呼ぶだけにした。ゲート内容の変更で触る場所を `package.json` の1箇所に保つ

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-07-26T00:00:00Z — `.gitignore` に2行追加した（`aidlc/spaces/*/intents/.aidlc-*` と `packages/*/aidlc/`）。既存の glob は intent ディレクトリ**内側**しか見ておらず、hooks-health マーカー（intents 直下）とパッケージ配下に生成されるセンサーのスクラッチが初回コミットに入る状態だった。フレームワーク同梱ファイルへの追記だが、除外の意図そのものは既存コメントが明示しており、それを実現する変更である

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-07-26T00:00:00Z — pre-commit ではなく pre-push にした。`bun run check` は数十秒かかり、コミットのたびに走らせると人はフックを外す。外されたゲートは無いのと同じなので、境界を「手元の履歴」ではなく「他人に渡る瞬間」に置いた
- 2026-07-26T00:00:00Z — フックの検証を肯定側だけで済ませず、型エラーを仕込んだ否定側を先に確認した。肯定側だけでは「常に 0 を返すフック」と区別がつかない

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-07-26T00:00:00Z — GitHub Actions workflow はリモートが無いため一度も実行されていない。未検証の設定を同梱している状態であり、初回実行は回帰検知ではなく受入確認として扱う必要がある
