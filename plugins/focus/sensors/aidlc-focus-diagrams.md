---
id: focus-diagrams
kind: deterministic
command: bun .claude/tools/aidlc-sensor-focus-diagrams.ts
default_severity: blocking
fire_on: gate
description: focus-flow の成果物の図が、リポジトリ内の元データから作られた最新の SVG であることを確かめる
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

承認の前に、成果物の Markdown が埋め込んだ図を確かめる。focus-flow 以外のスコープでは何もしない。

- 画像が外部の URL や絶対パスではなく、文書のフォルダー内の相対パスであること。
- SVG に、同じ名前の元データ（`.json`）があり、元データから作り直した結果と一致すること。
- 人が承認する主な成果物（要件・設計・Unit・Bolt の計画・テストと実装の報告書など）に、図が 1 つ以上あること。

失敗したら、図の元データを直し、`bun .claude/tools/focus-diagram.ts render <元データ>` で作り直す。
