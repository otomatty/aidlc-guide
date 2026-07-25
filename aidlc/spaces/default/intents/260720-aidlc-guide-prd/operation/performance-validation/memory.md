<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is maintained by the orchestrator during stage execution. Add observations at the gate ritual, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-07-26T00:00:00Z — 単一ユーザーのローカルツールに対する「負荷試験」を、同時接続数ではなく**データ規模（ファイル数）に対する応答時間**と解釈した。NFR-2/3 が定義しているのは体感の応答時間でありスループットではない
- 2026-07-26T00:00:00Z — P-AV-3「図ごと ≤500ms」は、ライブラリの動的 import を含む初回ではなく**常駐後の1図あたり**を対象と解釈した。要件文が「図ごと」であり、かつ設計が「初回出現時に import してメモ化」と明示しているため。両方の数値を残して判断根拠を示した

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-07-26T00:00:00Z — P-AV-4（保存）の計測を tb-lxp では行わず、687ファイルを複製したスクラッチで実施した。team.md の「tb-lxp は read-only フィクスチャとして扱い書き換えない」を守るため。計測後に tb-lxp が汚れていないことを git status と mtime で確認した

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-07-26T00:00:00Z — 平均値を出さず min/p50/p95/max のみを記録した。体感を決めるのは最悪値であり、平均は最悪値を隠す
- 2026-07-26T00:00:00Z — P-AV-2 を API 直叩きではなく**実 UI のクリック経路**で測った。API だけなら数 ms で終わるが、それでは「並行発火の機構が実際に効いているか」を含めた検証にならない。ついでに MA-6（mermaid 実描画）も同じ経路で閉じられた

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-07-26T00:00:00Z — 参加者側の反映時間（MA-4）は、同一 broadcast を使う設計から NFR-3 と同値になる**はず**だが実測していない。設計から導ける結論と実測を同じ強さで扱わないため、matrix には「推論」として区別して記録した
