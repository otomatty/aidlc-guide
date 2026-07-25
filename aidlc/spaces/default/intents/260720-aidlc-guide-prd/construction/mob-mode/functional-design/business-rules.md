# Business Rules — Unit: mob-mode

> functional-design (3.1) / Unit: mob-mode / 2026-07-25
> 入力: requirements.md（FR-7, NFR-7）+ project.md Mandated + decisions.md ADR-04 + components.md C5

## ルール

> BR-MM-1〜3/5/6 は **U5（dashboard-server）実装が満たすべき制約**として本 Unit が要求・検証する項目（実装の所有は U5 — BLM 冒頭の表）。BR-MM-4/7 と受入条件は本 Unit の作業に直接かかる。

| ID | ルール | 出所 |
|----|--------|------|
| BR-MM-1 | **既定は loopback。LAN 公開は `--host` 明示時のみ**（設定ファイルや環境変数で暗黙に有効化しない — 公開は常に明示的なコマンド操作） | NFR-7 / Mandated |
| BR-MM-2 | **`--host` 起動時は公開対象を名指しした警告を必ず出す**（何が見えるようになるかを具体的に述べる。単なる「LAN に公開しました」では不足） | US-19 / Mandated |
| BR-MM-3 | **hostMode 中の書込は無条件 403**（接続元・IP・User-Agent で分岐しない。区別できない前提に立つ） | ADR-04 / US-11 |
| BR-MM-4 | **参加者専用の配信経路・データ整形を作らない**（同一 SPA・同一 API・同一 broadcast。差は書込可否と ReadOnlyBadge/LiveStatus の提示のみ） | BR-DS-6 / 実装単一化 |
| BR-MM-5 | **公開を勝手に緩めない/強めない**: bind 失敗時に loopback へフォールバックしない。逆に、フラグ無しで LAN に出さない | 安全側デフォルト |
| BR-MM-6 | 認証・認可を実装しない（スコープ外）。代わりに**公開の可視性**（警告 + バッジ + アドレス表示）で人間の判断を支える | PRD §8 / NFR-7 |
| BR-MM-7 | ドライバーもモブ中は回答記入できない（ADR-04 の受容したトレードオフ）。**運用回避策の記載は ops-guides の必須項目**（components.md C8 で義務化済み） | ADR-04 |

## 検証可能な受入条件（本 Unit が担う E2E 検証）

- 既定起動でポートが LAN から到達不能（別端末から接続失敗）
- `--host` 起動でポートが LAN から到達可能 + 警告文言に「成果物」「監査」「秘密を含み得る」相当の語が含まれる
- `--host` 中の POST /api/answer が 403（curl で直接叩いても同じ）
- 参加者ブラウザの DOM に編集要素が存在しない
- ReadOnlyBadge が表示される（`role="status"`）
- LiveStatus が4状態（接続中 / ライブ更新中 / 切断・再接続中 / 更新停止）を正しく表示する
- 起動出力に待受アドレス一覧が含まれる（参加者に配る URL）
