# Requirements Analysis — 質問ファイル

> ステージ: requirements-analysis (Inception) / 深度: Standard  
> Intent: `260801-docs-locale`（docs-i18n **Bolt 2**）  
> 親: `260730-docs-i18n`（Bolt 1 / PR [#26](https://github.com/otomatty/aidlc-guide/pull/26)）  
> 追跡: Issue [#28](https://github.com/otomatty/aidlc-guide/issues/28)  
> 上流: [intent-statement.md](../../ideation/intent-capture/intent-statement.md) / [scope-document.md](../../ideation/scope-definition/scope-document.md) / codekb `aidlc-guide`  
> 前提: 親 requirements の FR-U2.3（keep-path + missing-anchor→top）・FR-U2.5（missing ja + notice + locale 維持）・NFR-3（branch coverage 95%）は **継承**。本ファイルは Bolt 2 実装完了に必要な細部だけを確認します。  
> 各質問の `[Answer]:` に選択肢の文字または自由記述を記入してください。  
> **Mode:** guided（推奨セット一括採用）

---

## Q1. 要件 ID の扱い

Bolt 2 の requirements.md で親 FR をどう扱いますか？

- A. 親 FR-U2.3 / FR-U2.5 / NFR-3 を参照継承し、Bolt 2 固有の差分だけを新しい ID（例: FR-B2.*）で書く
- B. Bolt 2 用に FR を一から採番し直し、親 ID は Traceability 表だけに残す
- C. 親 FR 本文をコピーして Bolt 2 向けに改訂した版を正本とする（親ファイルは更新しない）
- X. その他（具体的に記入）

[Answer]: A

## Q2. missing-ja notice の契約

`ja` ページが無いときの notice はどれが必須ですか？（select all that apply）

- A. 可視テキストで「未訳／英語を表示」であることが分かる（文言は実装で決めてよい）
- B. `role="status"`（または同等の live region）で支援技術に状態変化が伝わる
- C. locale コントロール／現在 locale 表示はユーザー選択の `ja` のまま（勝手に `en` に切り替えない）
- D. 本文は en フォールバックを表示する（親 FR-U2.5 継承）
- E. A〜D すべて必須
- X. その他（具体的に記入）

[Answer]: E

## Q3. notice の永続性・操作

未訳 notice の振る舞いとして正しいものはどれですか？

- A. 該当ページ表示中は常時表示。ユーザーが閉じても同一セッション内の再訪で再表示してよい（dismiss 永続化不要）
- B. ユーザーが閉じたら、その path ではセッション中再表示しない
- C. ユーザーが閉じたら、永続設定で以後その path を出さない
- D. dismiss UI は不要（閉じられない静的バナー）
- X. その他（具体的に記入）

[Answer]: A

## Q4. keep-path の範囲

en↔ja 切替で「同一 path を維持」に含めるものはどれですか？（select all that apply）

- A. ドキュメント相対 path（例: `guide/getting-started.md`）
- B. URL / ビュー内の `#anchor`（存在すればその見出しへ。無ければページ先頭 — 親 FR-U2.3）
- C. TOC 上の選択状態（同一 path の項目がハイライトされたまま）
- D. 検索クエリや一時 UI 状態は対象外
- E. A+B+C+D（A〜C を維持、D は対象外で明示）
- X. その他（具体的に記入）

[Answer]: E

## Q5. API / データ契約（notice・locale）

Docs Shell が未訳状態を知る一次情報源はどれですか？

- A. `/api/official-docs`（または同等）の応答に `locale`・本文・`untranslated`（または notice 用フラグ／メッセージ）を含める。UI はそれを表示するだけ
- B. UI が 404 等から推測し、notice 文言はフロント固定。API は本文のみ
- C. 専用エンドポイント（例: `/api/official-docs/meta`）で未訳判定し、本文取得と分離する
- X. その他（具体的に記入）

[Answer]: A

## Q6. coverage 床の対象

M4「official-docs の branch coverage 95% が `bun run check` で効く」の対象はどれですか？

- A. `packages/official-docs` の locale 解決・missing_ja / anchor 分岐モジュールに限定（親 NFR-3 の意図を継承）
- B. `official-docs` + Docs Shell 関連の `dashboard` / `api-core` ハンドラまで含める
- C. モノレポ全体の branch coverage 95%
- X. その他（具体的に記入）

[Answer]: A

## Q7. 表示面（Bolt 2）

Bolt 2 の受入対象サーフェスはどれですか？

- A. VS Code / Cursor 拡張の Docs Shell のみ（親と同様。ブラウザ / Mob LAN は検証対象外）
- B. 拡張 + `dashboard-server` ブラウザ経路の両方
- C. 拡張必須。ブラウザは best-effort（壊れても Bolt 2 Fail にしない）
- X. その他（具体的に記入）

[Answer]: A

## Q8. Should 項目（h1）

Docs Shell の `h1` 階層修正（scope S1 / Codex 指摘）を requirements 上どう書きますか？

- A. Should — 受入表に載せるが、Must 未達でも Bolt 2 を Fail にしない
- B. Must に昇格して必須にする
- C. Out of scope — requirements 本文に書かず、任意フォローアップ issue に残す
- X. その他（具体的に記入）

[Answer]: A

## Q9. 明示的に要件へ書かないもの

次のうち、本 Bolt の requirements.md に **含めない**ものはどれですか？（select all that apply）

- A. StageCard → Docs 深リンク（B3 / #29）
- B. BridgeRedirectPanel（B4 / #30）
- C. upstream 差分レポート本番化（B5 / #31）
- D. ダッシュボードの workflow live sync 不具合修正（Issue #33）
- E. A〜D すべて本 Bolt の requirements 外
- X. その他（含めるものがあれば記入）

[Answer]: E

## Q10. 成功の検証粒度

Bolt 2 Done（M1〜M4）の検証で最低限必要なものはどれですか？（select all that apply）

- A. 自動テスト（official-docs 分岐 + coverage 床が `bun run check` で落ちる）
- B. 拡張 Docs Shell での手動シナリオ（keep-path / missing-ja notice / missing-anchor）
- C. スクリーンショットまたは短い操作メモを PR / 成果物に残す
- D. A+B 必須、C は任意
- E. A+B+C すべて必須
- X. その他（具体的に記入）

[Answer]: D

---

## Consolidated Summary Confirmation

推奨セットを一括採用した結果の要約です。`requirements.md` 生成前に確認してください。

1. **Q1 = A** — 親 FR-U2.3 / FR-U2.5 / NFR-3 を参照継承し、Bolt 2 差分は FR-B2.* 等の新 ID
2. **Q2 = E** — missing-ja: 可視 notice + `role=status` + locale=`ja` 維持 + en 本文（すべて必須）
3. **Q3 = A** — notice は表示中常時。dismiss 永続化は不要（閉じても再訪で再表示可）
4. **Q4 = E** — keep-path は path + anchor（無ければ先頭）+ TOC 選択。検索等の一時状態は対象外
5. **Q5 = A** — `/api/official-docs` 応答が locale / 本文 / untranslated（notice）の一次情報源。UI は表示のみ
6. **Q6 = A** — coverage 95% 床は `packages/official-docs` の locale / missing_ja / anchor 分岐に限定
7. **Q7 = A** — 受入対象は拡張 Docs Shell のみ（ブラウザ / Mob は対象外）
8. **Q8 = A** — h1 階層修正は Should（Must 未達でも Bolt 2 Fail にしない）
9. **Q9 = E** — B3/#29・B4/#30・B5/#31・Issue #33 は本 Bolt requirements 外
10. **Q10 = D** — 自動テスト + 拡張手動シナリオは必須。スクショ/操作メモは任意

Does this all look correct before I generate the requirements artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
