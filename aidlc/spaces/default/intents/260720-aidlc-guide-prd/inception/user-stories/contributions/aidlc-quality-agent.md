**Collaborator:** aidlc-quality-agent

## Contribution

TESTABILITY lens。各 AC が具体的な pass/fail チェックか、Vitest で自動化可能か（tb-lxp フィクスチャ / データ契約）手動か、閾値や品質語を隠していないかを評価した。全体として lead ドラフトは requirements の測定可能 AC を素直に継承しており testable。以下、テスト種別の割り当てと要 sharpening 箇所のみ挙げる。

### ストーリー別テスト種別（QA 割り当て）

| # | 自動化可否 | テスト種別 | 備考 |
|---|-----------|-----------|------|
| US-01 | 自動 | RTL コンポーネント（Now strip 単体で5フィールド DOM 存在アサート、無操作） | gate 状態の取り得る値を列挙してから網羅 |
| US-02 | 自動 | 統合（fixture で「次ステージ」が決定的なもの、1クリックで次ステージ名+要求を検証） | 良好 |
| US-03 | **一部のみ自動** | 自動=フィールド存在+deep-link 解決 / **手動=「平易」品質** | 下記 OBJECT-1 |
| US-04 | 自動 | Vitest unit（docs-bridge 対応表、既知→定義 / 未知→「未定義」） | クリーンな pass/fail |
| US-05 | 自動 | ゴールデン統合（tb-lxp、件数+verdict、空/対象外セル区別） | 高価値パーサ golden |
| US-06 | **一部のみ自動** | 自動=コマンド組立を mock spawn で検証（`--permission-mode plan` 含む）/ 手動=実ターミナル起動（NFR-4 両OS） | 実 spawn は e2e/手動 |
| US-07 | 自動 | unit（最新セッションID解決を mock session dir で）+ help テキスト contains | help 出力検証は良好 |
| US-08 | **一部のみ自動** | 自動=`-p` フラグ透過を mock 検証 / 手動=実回答（非決定的） | 実回答は自動不可 |
| US-09 | 自動 | 統合（tb-lxp、構造化返却）+ read_artifact 境界拒否 | 境界は下記 OBJECT-6 |
| US-10 | **分離要** | 自動=伝播（file watch→WS→参加者ビュー反映）/ **perf-validation=NFR-3 ≤2s 計測** | 下記 OBJECT-2 |
| US-11 | 自動 | DOM アサート（編集 UI 不在+バッジ）… **だが不十分** | 下記 OBJECT-3 |
| US-12 | 手動 | 手順実施のドキュメントレビュー（F-08、自動不可） | manual と明記推奨 |
| US-13 | ハイブリッド | 自動=データ契約アサート（項目1-4 の一部）+ モード切替クラッシュ無（項目5）/ 手動=視覚忠実度（team-practices 手動ビジュアルチェックリスト） | 契約対象は正しい |
| US-14 | 自動 | Vitest unit（書込ガード）… **byte-golden へ強化推奨** | 最重要安全テスト。下記 OBJECT-4 |
| US-15 | 自動 | パーサ branch-coverage + 5失敗モード各1フィクスチャ golden | 下記 OBJECT-5 |

### 横断的テスト可能性ギャップ（Contribution note）

- **NFR-2（コールドスタート ≤3s）を担うストーリーが無い。** US-10 は NFR-3（反映 ≤2s）を拾うが NFR-2 はどのストーリーにも紐づかない。perf-validation ステージで計測される想定なら問題ないが、ストーリーからのトレース欠落として明示するか、US-01（Dashboard 初回描画）に perf 受入を付すか判断が要る。
- **NFR-4（Win/macOS）を owner するストーリーが無い。** spawn 系（US-06/07/08）とファイル監視（US-10）に暗黙にかかる。両OS 実行を要するテストは CI 基盤なしのローカルゲートでどう担保するか（両OS で `bun run check`）を delivery-planning/build-and-test に申し送りたい。

## Positions

**AGREE:** US-01, US-02, US-04, US-05, US-07, US-13 の AC は具体的な pass/fail チェックで、割り当てたテスト種別で検証可能。全 Must + 依存順の構成、および requirements の測定可能 AC（FR-4.1/4.6/6.1）継承に同意。US-13 が Milkdown 内部でなく「エディタへ渡すデータ契約」を検証対象とする方針は team-practices と整合しており支持する。

**OBJECT-1 [judgment]:** US-03 の AC「目的・入出力・担当・ゲート要求が**平易な言葉で**表示され」— 「平易」は検証不能な品質語（inception 規約の曖昧語禁止に抵触）。テスト可能部分（各フィールド非空 + docs deep-link が有効な節に解決する）と、主観部分（平易さ = 手動レビュー/初学者レビューチェックリスト）を AC 上で分離すべき。現状のままだと「平易か」で自動 pass/fail が出せない。

**OBJECT-2 [judgment]:** US-10 の AC が機能（ファイル変更→参加者ビュー反映）と性能閾値（NFR-3 2秒以内）を1つの Then に結合している。機能伝播は統合テストで自動化可能だが、2秒閾値は perf-validation でフィクスチャ計測すべき性能アサートで、CI 基盤なしのローカルではタイミングが不安定。機能 AC（「反映が発生する」）と性能 AC（「≤2s」→ perf-validation へ委譲）を分離し、機能テストが timing でフレークしないようにすべき。

**OBJECT-3 [knowledge]:** US-11 の AC は「編集 UI が DOM に存在しない」ことのみを検証するが、これは read-only の**必要条件であって十分条件ではない**。DOM に編集要素が無くても、参加者接続のトランスポート（WebSocket/HTTP）経由で書込を駆動できれば read-only 保証は破れる。参加者接続からの書込試行がサーバ側で拒否される、というサーバ側 AC を追加し、US-11 が「UI を隠す」ではなく「書けない」を保証するようにすべき（NFR-1/NFR-7 と対）。

**OBJECT-4 [judgment]:** US-14（書込境界、最重要安全テスト）の AC「その行のみ書き込まれる」は、他行が意図せず書き換わっていないことを保証しない。ファイル全体の byte-level ゴールデン比較（当該 `[Answer]:` 行以外は1バイトも変わらない）に強化し、拒否ベクタを列挙（①`*-questions.md` 以外のファイル ②`*-questions.md` 内の非 `[Answer]:` 行 ③パス外書込）すべき。書込境界は本ツールの安全性の要（NFR-1）で、テストの精度が保証の精度そのもの。

**OBJECT-5 [judgment]:** US-15 の AC「5失敗モードの**いずれか**」は、1モードのみのテストでも AC 充足と読める。team-practices はパーサを branch-coverage 重視・全失敗モード網羅と規定しており、5モード**それぞれに専用フィクスチャ**を要求し、かつ各ケースで健全な兄弟要素が通常描画されることを併せてアサートするよう AC を明確化すべき（reader-core の判別可能ユニオン Result 各分岐 = branch-coverage 対象）。

**OBJECT-6 [knowledge]:** US-09 / FR-2.4 の read_artifact 境界拒否 AC が「記録外パス」と抽象的。セキュリティ境界テストとしては拒否ベクタを列挙する必要がある（`../` トラバーサル、記録外の絶対パス、シンボリックリンク経由の脱出）。「記録外パス→拒否」だけだと素朴な相対パス1本のテストで通ってしまい、実際の脱出経路が未カバーになりうる。
