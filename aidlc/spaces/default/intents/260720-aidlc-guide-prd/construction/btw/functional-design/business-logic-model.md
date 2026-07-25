# Business Logic Model — Unit: btw

> functional-design (3.1) / Unit: btw (kind: service, S) / 2026-07-23
> 入力: unit-of-work.md U3 + unit-of-work-story-map.md（US-06/07/08）+ requirements.md（FR-3）+ components.md C7 + component-methods.md（btw CLI 表）+ services.md S3

## 処理フロー（3コマンド）

### F1: `btw`（US-06 / FR-3.1）

```
parse args → 前提チェック（claude CLI 存在）
  → 不在: エラー + 導入案内を stderr、exit 1
  → 存在: OS 判定（process.platform）
      darwin: 新ターミナルで `claude --permission-mode plan` を spawn（open -a Terminal 相当）
      win32 : `cmd /c start` 相当で新ウィンドウ spawn（Git Bash 環境含む）
      その他: 未対応 OS メッセージ、exit 1
  → spawn 成功: 案内1行を stdout、exit 0 / spawn 失敗: 理由 + exit 1
```

### F2: `btw --fork`（US-07 / FR-3.2）

```
前提チェック → 最新セッション ID 解決:
  slug = projectSlug(process.cwd())          ← 下記の変換規則
  ~/.claude/projects/<slug>/ 配下の *.jsonl を mtime 降順で走査 → 先頭のファイル名 = セッション ID
  → ディレクトリ不在: 「本線セッションが見つからない（探索先: <計算したパス>）」+ /branch 案内、exit 1
  → JSONL 0件: 同上
  → 見つかった: F1 と同じ OS 分岐で `claude --fork-session <id> --permission-mode plan` を spawn
     spawn 前に fork 制約の注意1行（JSONL は最終フラッシュ時点 — C-T5）を stdout
```

**cwd→slug 変換規則（`projectSlug`）**: Claude Code のプロジェクトディレクトリ命名規約に一致させる — **絶対パス中のパス区切り・ドライブコロン・ドット（`\` `/` `:` `.`）を各1文字ずつ `-` に置換**する。実例（本ワークスペースで観測した実規約）:

- Windows: `C:\work\aidlc-guide` → `C--work-aidlc-guide`（`:`→`-`、`\`→`-`）
- macOS: `/Users/dev/aidlc-guide` → `-Users-dev-aidlc-guide`（先頭 `/` も `-` になる）

この規約は Claude Code 内部実装への依存であり、バージョン差で変わり得る（external-dependency-map E3）。**防御**: 計算したディレクトリが不在の場合はエラーメッセージに計算パスをそのまま表示し（ユーザーが実ディレクトリと突合できる診断性）、btw README に検証済み Claude Code バージョンを記録する（E3 の緩和策どおり）。

### F3: `btw -p "<質問>"`（US-08 / FR-3.3）

```
前提チェック → 現在ターミナルで `claude -p "<質問>" --permission-mode plan` を同期実行
  → stdout をそのまま透過、exit code も透過
```

### F4: `btw --help`（FR-3.4）

静的テキスト出力: 3コマンドの説明 + **fork の既知の制約**（`--fork-session` の JSONL は最終フラッシュ時点であり本線実行中の直近会話が乗らないことがある）+ **文脈が必要なら本線内 `/branch` を第一案内**。

## エラーハンドリング（Construction 規約: 境界で必ず処理・黙殺禁止）

| 障害 | 挙動 |
|------|------|
| claude CLI 不在 | stderr に導入手順、exit 1（fail fast） |
| セッション JSONL 不在/読取不能 | stderr に理由 + `/branch` 代替案内、exit 1 |
| spawn 失敗（端末アプリ不在等） | stderr に OS 名 + 失敗理由、exit 1 |
| 未対応 OS | stderr に対応 OS 一覧、exit 1 |

例外は CLI 境界で捕捉して exit code に変換（スタックトレースを生で見せない）。

## 統合ポイント

Claude Code CLI のみ（external-dependency-map E3）。他 Unit と非依存（DAG どおり）。reader-core を import しない。

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-23

- `projectSlug` is now defined as a concrete rule (replace each of `\` `/` `:` `.` with `-`) with both a Windows example (`C:\work\aidlc-guide` → `C--work-aidlc-guide`) and a macOS example (`/Users/dev/aidlc-guide` → `-Users-dev-aidlc-guide`); both examples hand-trace correctly against the stated character-substitution rule, and the Windows case matches the slug this very session's own tooling produces for this workspace's cwd, so the claimed "observed real convention" grounding checks out rather than being asserted blind.
- Version-drift risk is defended on two fronts as promised: the computed path is shown verbatim in the not-found error message (F2 flow and the dedicated mitigation paragraph both state this), and a verified-CLI-version record in the btw README is committed as the E3 mitigation — closing the prior gap where drift had no detection/diagnostic path.
- BR-2 in business-rules.md now cites the transform rule by name and cross-references business-logic-model.md, and the domain-entities.md test-boundary section lists an explicit pure-function `slug` test covering both OS cases with the same example values — the fix is threaded through all three artifacts consistently, not just the one file.
- Regression check: no new contradictions found — F2's `slug = projectSlug(process.cwd())` pointer, BR-2's resolution description, and SessionRef's `jsonlPath` diagnostic field all agree with the new rule and with each other; error-handling table and BR-6 (non-zero exit + one-line reason) remain intact and unaffected by the change.

