# Tech Stack Decisions — Unit: mob-mode

> nfr-requirements (3.2) / Unit: mob-mode / 2026-07-25
> 入力: functional-design（U5 所有表 + 本 Unit の差分）+ decisions.md ADR-04 + team-practices.md

## スタック

| 領域 | 選定 | 理由 |
|------|------|------|
| サーバ | **dashboard-server と同一プロセス・同一実装**（別サーバを立てない） | ADR-04 |
| NIC 列挙 | `node:os` の `networkInterfaces()`（ビルトイン） | NFR-5 依存最小 / クロスOS |
| UI | dashboard-ui のコンポーネント群に ReadOnlyBadge / LiveStatus を追加（別アプリにしない） | BR-MM-4 実装単一化 |
| 依存 | 追加のランタイム依存ゼロ | NFR-5 |
| dev-time | Vitest（ExposureNotice 構築・LiveStatusView 導出）+ @testing-library/react（バッジ/ステータス）+ 実機モブでの E2E 検証（bolt-plan B7 の DoD） | team.md |

## 決定メモ

- 待受アドレスは IPv4 のみ列挙（IPv6 は社内 LAN のモブで共有 URL として使われない実態に合わせる。必要になれば追加）。
- 参加者数カウントの表示は不採用（SC-MM-2 — 認知負荷を増やす割に行動が変わらない）。
