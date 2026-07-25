# Domain Entities — Unit: ops-guides

> functional-design (3.1) / Unit: ops-guides (kind: spec) / 2026-07-25
> 入力: business-rules.md（G-1/G-2 と記載義務）+ unit-of-work.md U9 + requirements.md FR-8
> 注: 実行コードを持たない文書 Unit のため、「エンティティ」= 文書の構造（見出し骨格）とその必須要素。

## G-1: `docs/guides/live-share.md` の構造

```
# Live Share 運用ガイド（モブセッション）
## 前提と適用範囲            … 何を解決するか / 使えない場合の代替への導線
## セットアップ              … 拡張導入・サインイン・ワークスペース共有の開始
## ターミナルの read-only 共有 … liveshare.autoShareTerminals 等の設定名と値、read-only にする理由（BR-OG-3）
## Dashboard の併用          … --host での LAN 公開手順、警告の読み方、参加者への URL 共有（U8 の実装文言を参照 — BR-OG-6）
## モブ中の回答記入          … **必須節**（BR-OG-1）: --host 中は記入不可 → 口頭合意 → ドライバーが本線 or 停止後に記入
## リモート参加（トンネル公開） … cloudflared / Tailscale の手順 + **認証注意**（BR-OG-2）
## 使えないときの代替        … tmux 共有 / Dashboard 単独運用（BR-OG-5）
## トラブルシュート          … 接続できない / 反映されない（LiveStatus の読み方）
```

## G-2: `docs/guides/async-sharing.md` の構造

```
# 非同期共有規約
## 目的                      … 同席できない参加者への共有
## ゲート通過時の自動 push   … フックのサンプル（コピペ可能 — BR-OG-7）と導入手順
## 参加者側: checkout 不要の閲覧 … git fetch + git show origin/<branch>:<path> の具体例
## 何を共有し、何を共有しないか … aidlc 記録は共有 / ローカル cursor・machine-local は対象外（.gitignore の説明）
## 使えないときの代替        … 手動 push / 成果物の添付（BR-OG-5）
```

## 必須要素チェックリスト（受入判定に使う）

| 要素 | 所在 | 根拠 |
|------|------|------|
| 「モブ中の回答記入」節 | G-1 | BR-OG-1 / ADR-04 / components.md C8 |
| 認証注意（トンネル） | G-1 | BR-OG-2 / NFR-7 |
| `liveshare.autoShareTerminals` 等の具体設定 | G-1 | BR-OG-3 |
| push フックのサンプル + `git show` 手順 | G-2 | BR-OG-4 / US-22 AC |
| 代替手段の節 | G-1・G-2 両方 | BR-OG-5 |
| 実装文言との一致（警告文） | G-1 | BR-OG-6 |

## 依存とタイミング

U8（mob-mode）の実装文言・挙動を参照するため、**G-1 は U8 完了後に確定**（bolt-plan B7 で同一 Bolt）。G-2 は git 手順のみで U8 に依存しない（先行着手可 — unit-of-work U9 の注記どおり）。
