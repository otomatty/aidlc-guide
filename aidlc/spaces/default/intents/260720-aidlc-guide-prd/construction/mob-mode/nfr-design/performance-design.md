# Performance Design — Unit: mob-mode

> nfr-design (3.3) / Unit: mob-mode / 2026-07-25
> 入力: nfr-requirements/performance-requirements.md（P-MM-1〜3）+ functional-design（M1〜M3）

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| P-MM-1（NIC 列挙 ≤100ms） | `os.networkInterfaces()` を起動時1回だけ呼び、結果を ExposureNotice に固めて保持（再列挙しない） |
| P-MM-2（再描画を誘発しない） | ReadOnlyBadge は `serverMode.hostMode`（不変値）のみ、LiveStatus は `live` slice のみ購読。両者を独立コンポーネントにして memo 境界を切る |
| P-MM-3（参加者も NFR-3 内） | 追加機構なし — U5 の同一 broadcast をそのまま使う（参加者専用経路を作らないことが性能上も最適） |

## 非採用

アドレスの動的再列挙（NIC 変化の追従）、接続数に応じた送信制御（SC-MM の上限内では不要）。
