# Security Design — Unit: mob-mode

> nfr-design (3.3) / Unit: mob-mode / 2026-07-25
> 入力: nfr-requirements/security-requirements.md（S-MM-1〜6）+ functional-design（U5 所有表 / BR-MM-*）

## 設計（要件→機構）

| 要件 | 実装所有 | 機構 |
|------|---------|------|
| S-MM-1（既定 loopback） | U5 | `ServeOptions.host` の単一分岐（U5 実装）。本 Unit はこの分岐に**追加の有効化経路を作らない**ことを保証（env/config を読まない） |
| S-MM-2（警告） | U5（文言）+ 本 Unit（アドレス） | U5 の警告定数の直後に `ExposureNotice.addresses` を出力。**文言は import して使う（複製しない）** |
| S-MM-3（無条件 403） | U5 | 本 Unit は追加の書込 API を定義しない（構造的に 403 を迂回できない） |
| S-MM-4（内部情報を出さない） | 本 Unit | 列挙は `family==="IPv4" && !internal` のみ。`os.hostname()` / ユーザー名 / ワークスペースパスを出力に含めない（出力構築関数の入力を IP と port に限定） |
| S-MM-5（可視性の担保） | 本 Unit | 起動出力（U5警告 + アドレス）+ ReadOnlyBadge の3点を必ず提示。どれか1つでも欠けたら受入不可 |
| S-MM-6（実行中不変） | 本 Unit + U5 | `hostMode` を起動時に確定した const として保持し、変更 API を定義しない（型レベルで readonly） |

## 信頼境界

`--host` 時、境界は「同一 LAN の任意端末 → HTTP/WS」。認証なしのため、境界の統制は**露出の可視化**（S-MM-5）と**書込の完全遮断**（S-MM-3）の2点のみ。読取は公開の意図そのもの。
