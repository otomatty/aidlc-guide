# Reliability Requirements — Unit: reader-core

> nfr-requirements (3.2) / Unit: reader-core / 2026-07-24
> 入力: functional-design/business-rules.md（5失敗モード表・BR-RC-2/5）+ requirements.md（NFR-6）+ team-practices.md（テスト方針）

## 要件

| ID | 要件 | 検証 |
|----|------|------|
| R-RC-1 | **throw ゼロ**: 公開7メソッドはあらゆる入力で ReadResult を返す（内部例外は境界 catch で error 化） | プロパティ的テスト（壊れ fixture 群で例外が漏れない） |
| R-RC-2 | **5失敗モードの局所縮退**: モード①〜⑤各1 fixture で「健全部分は返り、該当要素のみマーク」を個別検証（US-15 AC） | tb-lxp 派生の壊れ fixture 5種 |
| R-RC-3 | **書きかけファイル耐性**: エンジンが書込み中の state（途中まで・空・BOM 付き）でクラッシュせず error/unparseable 化。watch 通知後の読取りで自然回復（次スナップショット） | 途中状態 fixture |
| R-RC-4 | **watch の堅牢性**: 監視対象の一時消失（git 操作等での rename/delete）で watcher が死なない。dispose 後のコールバック発火なし | chokidar 挙動テスト |
| R-RC-5 | **決定性**: 同一 FS 状態からの読取は常に同一モデル（順序は名前/時刻で安定ソート）。ゴールデンテストの前提 | tb-lxp ゴールデン（コミットピン — team.md） |

## テスト水準（team.md Testing Posture の適用）

パーサ（parse/ + 縮退分岐）は**ブランチカバレッジ重視** + tb-lxp ゴールデン。G-1〜G-6 の各分岐・G-3 の全 mark・unsupported 経路を網羅。reader-core は本プロジェクトの「リスクの中心」（team.md）であり、カバレッジ床はラインでなくブランチで見る。
