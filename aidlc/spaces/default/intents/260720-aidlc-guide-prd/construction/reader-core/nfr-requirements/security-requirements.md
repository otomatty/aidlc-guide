# Security Requirements — Unit: reader-core

> nfr-requirements (3.2) / Unit: reader-core / 2026-07-24
> 入力: functional-design/business-rules.md（BR-RC-1〜7）+ business-logic-model.md L6 + requirements.md（NFR-1）

## 要件

| ID | 要件 | 検証 |
|----|------|------|
| S-RC-1 | **書込 API ゼロ**: fs の read 系（readFile/readdir/stat/realpath/watch）のみ import。write 系 import は Biome restricted-imports で構造禁止（BR-RC-1/NFR-1） | lint ルール + import 走査テスト |
| S-RC-2 | **読取境界の一次 enforcement**: readArtifact は L6 の resolve→relative→realpath アルゴリズムで 3ベクタ（`../` / 記録外絶対 / symlink）を拒否。startsWith 比較禁止 | 3ベクタ + `/rec/foobar` 誤許可ケースの unit テスト |
| S-RC-3 | **機微情報の非保持**: 監査・成果物の本文をモデルに保持しない（BR-RC-6）。エラー/warnings にファイル内容を含めない（パス・理由のみ） | モデル型検査 + エラーパステスト |
| S-RC-4 | **入力を信頼しない**: state/監査/成果物は「壊れている前提」でパース（G規則の縮退分岐）。無限ループ禁止（全パーサは行単位の単方向走査のみ）。**読取時の過大メモリ確保は readState/readArtifact のファイルサイズ上限 10MB（超過は {error, reason:"file-too-large"} で読み込み前拒否）で bound**（BR-RC-6 の本文非保持はモデル常駐分の抑制であり、読取時 bound はこの上限が担う — 役割を区別） | 不正 fixture のブランチテスト + サイズ超過 fixture |

## 非該当

認証・暗号・ネットワーク境界なし（純ライブラリ、listen しない）。依存は chokidar のみ（lockfile ピン + `bun audit` は全体ゲート）。
