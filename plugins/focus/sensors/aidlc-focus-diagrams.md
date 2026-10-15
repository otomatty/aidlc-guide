---
id: focus-diagrams
kind: deterministic
command: bun .claude/tools/aidlc-sensor-focus-diagrams.ts
default_severity: blocking
fire_on: gate
description: focus-flow の成果物に図（SVG か Mermaid）があり、SVG が文書のフォルダーの中にあって外部を参照せずスクリプトを含まないことを確かめる
category: document-quality
matches: "**/{intents,codekb}/**/*.md"
timeout_seconds: 30
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  diagrams: number
  violations:
    - code: string
      message: string
      target: string
---

# focus-diagrams センサー

承認の前に、成果物の Markdown の図を確かめる。focus-flow 以外のスコープでは何もしない。
図はエージェントが自由に描くため、描き方や見た目は確かめない。

- 人が承認する主な成果物（要件・設計・Unit・Bolt の計画・テストの確認・テストと実装の報告書）に、
  図（SVG の画像か Mermaid のブロック）が 1 つ以上あること。
- 画像が外部の URL や絶対パスではなく、文書のフォルダー内の相対パスで、ファイルがあること。
- SVG のルートが `<svg>` で `viewBox` があり、1 MB 以下であること。
- SVG に `<script>`、イベントの属性、`<foreignObject>` などの埋め込み、DOCTYPE がなく、
  図の中（`#id`）と埋め込んだラスター画像（`data:image/png` など）以外を参照しないこと。
- Mermaid のブロックが、図の種類（`flowchart` など）から書き始められていること。

失敗したら、指摘された図を描き直す。

`command` の `bun` は、エンジンがスクリプトの場所を見つけるための書き方。ネイティブの `aidlc` は
このスクリプトを読み込んで `main()` を呼ぶため、利用者の環境に bun は要らない。
