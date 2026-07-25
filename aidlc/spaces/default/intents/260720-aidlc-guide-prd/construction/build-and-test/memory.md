<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is maintained by the orchestrator during stage execution. Add observations at the gate ritual, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-07-25T00:00:00Z — Test Strategy=Standard の既定生成物は unit + integration だが、performance / security も生成した。この2つは本プロジェクトでは「あれば良い」ではなく受入条件そのもの（NFR-1/2/3/7 と project.md Mandated）であり、手順を残さないと検証が失われるため
- 2026-07-25T00:00:00Z — 統合テストに別コマンドを設けず `bun run check` 1本に収束させた。ローカルゲートが1本という team.md の方針を、テスト種別を増やす方向で崩さない

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-07-25T00:00:00Z — バンドル汚染チェック（P-AV-1）を `assets/index-*.js` のグロブで走査して誤検出した（同じ命名の遅延チャンクにも一致し mermaid が7件出た）。`index.html` が実際に参照するエントリ名を取り出してから走査するよう直した。ビルド成果物の検証は「名前の形」ではなく「エントリポイントの定義」から辿る

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-07-25T00:00:00Z — symlink による containment 突破ベクタが本実行環境（Windows・開発者モード未有効）で skipIf により skip された。skip は「検証済み」ではない。権限のある環境で一度通す必要がある
