# User Flow — AIDLC Guide

> ステージ: rough-mockups (Ideation 1.6) / 作成日: 2026-07-22
> 入力: intent-statement.md（3ペルソナ: 初学者/ドライバー/モブ参加者）+ scope-document.md + intent-backlog.md
> 3ペルソナ均等（intent-statement）のため、主フローも3本立てる。北極星は S-1（初学者が1分以内に現在地を説明）。

---

## フロー1（主・happy path）: 初学者が現在地を理解する

北極星 S-1 に直結。最短で「今どこ・次何・そこで何を求められる」に到達させる。

```
[初学者] Dashboard を開く
   │
   ▼
S-1 起動 ──► Now strip が最上部で即答: フェーズ / ステージ / ユニット / 完了数(15/22)   ← ここまで数秒（S-1北極星の核）
   │           （intent 未解決なら S-4 → インテント選択 → S-1 へ）
   │
   ├─(現在ステージを深掘り)─► Stage rail の ● 現在ステージをクリック
   │                              │
   │                              ▼
   │                       S-2a 解説カード: 目的・入出力・担当エージェント・「ゲートで人間に求められること」
   │                              │
   │                              ├─(もっと知りたい)─► [公式docsを開く] deep-link (F-05) ──► 完（自己解決 S-4指標）
   │                              └─(用語が不明)────► MCP glossary or カード内用語 ──► 完
   │
   └─(次に何が来る)──► Stage rail の次ステージ（○ 未着手の先頭）をクリック ──► S-2a で next steps 確認 ──► 完
```

**成功条件**: 起動→現在地把握が 1 分以内（S-1）。Now strip 単体で「現在地」、S-2a 1クリックで「次・求められること」に到達。

---

## フロー2: ドライバーが本線を汚さず調べ物をする

P-3（調べ物が本線を汚す）を解消。btw（F-03）+ MCP（F-02）。

```
[ドライバー] 本線 Claude Code でワークフロー進行中、技術/用語/状況の疑問が発生
   │
   ▼
別ターミナルで  btw  実行（読み取り専用サイドセッション起動 / --permission-mode plan）
   │                    （本線の文脈が要る場合は btw --fork。fork制約は help 明記 C-T5）
   │                    （ワンショットなら btw -p "<質問>"）
   ▼
サイドセッションの Claude Code が MCP 5ツールで回答:
   ├─ aidlc_status ──────► 現在地
   ├─ aidlc_explain_stage ► ステージ解説（docs対応表参照）
   ├─ aidlc_next_steps ───► 次に来るもの
   ├─ aidlc_read_artifact ► 成果物本文
   └─ aidlc_glossary ─────► 用語
   │
   ▼
疑問解消 ──► 本線セッションは無汚染のまま進行継続（S-3: やり直し削減 / S-4: 自己解決率）
```

**分岐/エラー**: `--fork` の JSONL が最終フラッシュ時点で直近会話を欠く場合（C-T5）→ help/ドキュメントの明記どおり本線内 `/branch` を第一案内。

---

## フロー3: モブ参加者がライブで状態を追う

G-5 / S-2。ドライバーが LAN 公開、参加者はブラウザ閲覧。

```
[ドライバー]  dashboard --host  で LAN 公開（既定は localhost、--host は明示フラグ C-T6/NFR-7）
   │
   ▼
[モブ参加者] 共有 URL をブラウザで開く
   │
   ▼
S-3 参加者ビュー表示（read-only バッジ、S-1 と同一レイアウト）
   │
   ▼
ドライバーがステージ遷移・成果物生成
   │  file監視 → WebSocket push（FR-7.2）
   ▼
参加者ビューに即時反映（変更→反映 2秒以内 NFR-3、aria-live で読み上げ）
   │
   ├─ 参加者は Now strip / Stage rail / マトリクス / 成果物ビューアを自分で閲覧
   │   （口頭確認なしにブランチ状態把握 → S-2）
   └─ 編集は不可（FR-7.3。[Answer] 編集欄も非表示）
```

**補足**: リモート参加のトンネル公開（cloudflared/Tailscale）はツール外の運用ガイド（F-08）で案内。非同期共有はゲート時 git push フック + `git show origin/<branch>:<path>`（F-08）。

---

## 全体フロー俯瞰（3サーフェス × 3ペルソナ）

```
                    aidlc-reader (F-01) = 単一の状態モデル
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   MCP (F-02)            Dashboard (F-04)       Mob push (F-07)
   + btw (F-03)          + Docs Bridge(F-05)    + Live Share(F-08)
   + Docs Bridge         + Viewer (F-06)
        │                     │                     │
   [ドライバー]           [初学者]              [モブ参加者]
   本線を汚さず調べる      現在地を理解する       ライブで状態を追う
   (フロー2)              (フロー1・北極星)      (フロー3)
```

3ペルソナ均等（intent-statement）。M1(reader+MCP)=フロー2の基盤、M2(Dashboard)=フロー1、M3(Viewer)=フロー1/2の成果物閲覧を強化、M4(Mob)=フロー3。依存順どおり基盤から積む。
