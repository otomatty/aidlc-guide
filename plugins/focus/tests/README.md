# focus プラグインのテスト

テストはこのフォルダーに置く。`tools/` に置くと、合成のときに利用者のプロジェクトへコピーされる。

- `focus-diagram.test.ts`: 図の描画と検査のツール（`tools/focus-diagram.ts`）
- `plugin-content.test.ts`: ステージ・追記・エージェント・スコープの約束

リポジトリのルートで `bun run check` を実行すると、これらのテストと、公式の検証（validate）・合成テスト
（`aidlc-plugin-test.ts`）が走る。
