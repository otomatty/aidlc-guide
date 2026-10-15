# focus プラグインのテスト

テストはこのフォルダーに置く。`tools/` に置くと、合成のときに利用者のプロジェクトへコピーされる。

- `focus-diagram.test.ts`: 図の検査（`tools/focus-diagram.ts`）と、センサーの入口（`tools/aidlc-sensor-focus-diagrams.ts`）
- `plugin-content.test.ts`: ステージ・追記・エージェント・スコープの約束と、導入先で bun を求めないこと

リポジトリのルートで `bun run check` を実行すると、これらのテストと、公式の検証（validate）・合成テスト
（`aidlc-plugin-test.ts`）が走る。
