# Business Logic Model — Unit: artifact-viewer

> functional-design (3.1) / Unit: artifact-viewer (kind: ui, M) / 2026-07-25
> 入力: unit-of-work.md U7 + unit-of-work-story-map.md（US-13/US-14）+ requirements.md（FR-6.1/6.2/6.3）+ components.md C6（ArtifactViewer/AnswerEditor）+ refined-mockups M-2b + decisions.md ADR-05（Milkdown 隔離）
> 注: kind:ui のため produces は business-logic-model + frontend-components（business-rules / domain-entities は produces_kinds 対象外）。

## 前提: M3 冒頭の候補検証（feasibility R-2 / US-13 AC）

実装の**最初の作業**は Milkdown/Crepe の実データ検証。tb-lxp から抽出した5成果物（GFM テーブル / Mermaid / ネストリスト / コードフェンス / 見出し階層 を含む）に対し5項目チェックリスト（表の保持 / Mermaid 描画 / 構造保持 / 往復無欠落 / モード切替でクラッシュしない）を実施し、**1項目でも不合格なら候補交代**（BlockNote → plain preview の順に評価）。交代しても本 Unit の外部契約（下記データ契約）は変えない — それが ADR-05 の隔離の目的。

## D1: 成果物の表示（US-13 / FR-6.1・6.3）

```
openArtifact(path):
  1. GET /api/artifact?path=<path> → ReadResult 相当のペイロード
     - error(outside-record/artifact-not-found/file-too-large) → 局所エラー表示（パネル内）
     - unsupported → 「解析不可」表示
  2. markdown 文字列をビューアへ渡す（データ契約: 入力は markdown 文字列のみ）
  3. Mermaid ブロックは描画（FR-6.3）。構文不正はコードブロックとして表示しクラッシュしない
  4. 既定 read-only（編集モードに入らない）
```

## D2: 質問ファイルの回答記入（US-14 / FR-6.2）

```
編集可否の判定（クライアント側の一次判定 — 最終判定はサーバ）:
  editable = basename(path) が *-questions.md にマッチ
             && 対象行が /^\[Answer\]:/ で始まる
             && `serverMode.hostMode === false`（`GET /api/workflow` が返す ServerMode —
                dashboard-server contract。US-11 二重防御の片翼＝DOM 不在の根拠）

保存:
  POST /api/answer {file, line, value}
    - 403 read-only-mode        → 「モブ公開中は記入できません（ドライバーが本線で記入）」
    - 403 not-a-questions-file  → 「このファイルは編集できません」
    - 403 outside-record        → 「記録ディレクトリ外のファイルは編集できません」
    - 403 not-an-answer-line    → 「この行は編集できません」
    - 500 write-verification-failed → 「保存を中止しました（ファイルは変更されていません）」
    - その他（未知の error 識別子 / ネットワーク失敗）→ 「保存できませんでした（<識別子 or 理由>）」
      ＋再試行導線（default 分岐を必ず持つ — サーバのゲートが増えても黙って落ちない）
    - 200 ok → **保存後の再取得と再検証**: 直後に `GET /api/artifact?path=<file>` を再発行し、
      返ってきた新バイト列と保存前に保持していた元バイト列を比較して、**対象行以外がバイト不変**
      であることをクライアントでも確認（interaction-spec.md / US-14。不一致なら
      「保存内容が想定と異なります」を警告表示 — サーバ側 BR-DS-7 と独立した二重確認）。
      表示更新もこの再取得結果を使う（WS には成果物本文を運ぶ scope が無いため — dashboard-server
      の watch 通知は state/matrix/audit のみ。サーバが唯一の真実である点は変わらない）
```

**クライアントは楽観更新しない**（保存後もサーバ由来の再取得を待つ — 二重真実を作らない）。

## D3: 表示状態（5状態 — refined-mockups Q2）

| 状態 | 表示 |
|------|------|
| loading | スケルトン（200ms 閾値、dashboard-ui と同一フック） |
| empty | 「成果物がありません」 |
| error | (a) API 取得失敗（outside-record / not-found / too-large / unsupported の理由を明示）または (b) **ビューア実行時クラッシュ**（Milkdown 等が特定成果物で例外）→ **plain preview（`<pre>` 生 Markdown）へ実行時フォールバック** + 「リッチ表示できないため素のテキストで表示しています」注記（mockups.md M-2b / interaction-spec.md の error 定義。M3 冒頭の候補検証はフィクスチャ5件に対する事前判定であり、未知の成果物での実行時クラッシュはこの経路で救う） |
| partial | ビューアが一部を描画できない場合（Mermaid 構文不正等）→ 該当ブロックのみコード表示 + 注記 |
| success | 完全表示 |

## データ契約（候補交代に耐える境界 — ADR-05）

- **入力**: `{ markdown: string, editable: EditableSpec | null }`（`EditableSpec = { answerLines: number[] }`）
- **出力（編集時）**: `{ line: number, value: string }` のみ（差分でなく行と値）
- ビューア実装（Milkdown/BlockNote/plain）はこの契約の内側に隠す。テストはこの契約に対して書く（team.md: 「テストは Milkdown 内部でなくエディタへ渡すデータ契約を対象」）。

## Post-review resolution (lead, 2026-07-25)

レビューのイテレーション上限（2/2）到達後、残余の Finding 3 派生（保存後のバイト不変再検証が「WS 由来の新バイト列」を前提にしていたが、dashboard-server の WS には成果物本文を運ぶ scope が存在しない）を、レビュアー提示の選択肢2（200 応答を受けて `GET /api/artifact` を再取得し、その結果で再検証と表示更新を行う）で解消。WS プロトコルに新 scope を足さずに済み、サーバのステートレス設計とも整合する。Findings 1/2/4/5 はイテレーション2で解決済み。→ 全5件解決。
