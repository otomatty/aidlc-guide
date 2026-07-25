# Performance Design — Unit: reader-core

> nfr-design (3.3) / Unit: reader-core / 2026-07-24
> 入力: nfr-requirements/performance-requirements.md（P-RC-1〜5）+ functional-design/business-logic-model.md（L1〜L7）

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| P-RC-1（readState ≤100ms） | 行イテレータの単一パス（正規表現は行頭アンカー付き固定6種のみ、バックトラック無し）。ファイル1枚・分割読みしない |
| P-RC-2a（全走査 ≤2s、起動時のみ） | unit ディレクトリ単位に並列 readdir（Promise.all、同時 8 目安）。verdict は末尾 4KB の部分読取（`file.slice(-4096)`）。全文読みゼロ |
| P-RC-2b（unit 再構築 ≤300ms） | buildMatrixForUnit は対象 unit の readdir + tail 読みのみ（数十ファイル規模） |
| P-RC-3（audit ≤500ms） | シャードは並列読取 → ブロック分割はストリームでなく全文 split（シャードは小さい・BR-RC-6 で保持しない）。マージは k-way でなく concat + sort（シャード数 ≤ 数個） |
| P-RC-4（reader 分 ≤1.0s） | debounce はイベント種別ごとに独立タイマー（state 変更が audit 走査を誘発しない — scope 分類が上流で分岐） |
| P-RC-5（常駐 ≤10MB） | モデルは抽出フィールドのみ保持。tail バッファ・全文バッファはスコープ抜けで解放（キャッシュしない） |

## 非採用（過剰設計の明示）

インデックスファイル・増分キャッシュ・worker スレッドは不採用 — 593規模の実測が予算内なら足りる（performance-validation で実測し、超過したら P-RC-2a の並列度から調整）。
