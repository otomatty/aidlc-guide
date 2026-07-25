# Performance Requirements — Unit: artifact-viewer

> nfr-requirements (3.2) / Unit: artifact-viewer (kind: ui, M) / 2026-07-25
> 入力: functional-design/business-logic-model.md（D1〜D3）+ frontend-components.md + requirements.md + dashboard-ui P-UI 予算
> 注: kind:ui のため produces は performance / security / tech-stack の3点（scalability/reliability は produces_kinds 対象外 — 該当する信頼性要件は functional-design の D3 とホスト Unit の R-UI に内包）。

## 要件

| ID | 要件 | 測定 |
|----|------|------|
| P-AV-1 | **遅延ロード**: 本 Unit（Milkdown + Mermaid 含む）は初期バンドルに含めない。DetailPanel が成果物を開いた時に動的 import（dashboard-ui P-UI-1 の初期バンドル予算を侵さない） | バンドル解析（初期チャンクに milkdown/mermaid が無いこと） |
| P-AV-2 | **初回オープン ≤1.5秒**（チャンク取得 + `GET /api/artifact` [サーバ P-DS 系] + 描画）@ 一般的な成果物（〜100KB）。2回目以降はチャンク済みで ≤0.8秒 | 計測 |
| P-AV-3 | **Mermaid 描画は図ごと ≤500ms**、mermaid ライブラリ自体も図が現れた時のみ動的 import | 計測 |
| P-AV-4 | 保存操作（POST + 再取得 + 再検証）≤1.5秒。バイト比較は文字列比較1回（差分アルゴリズム不要） | 計測 |
| P-AV-5 | サーバが返し得る最大サイズ（**10MB — reader-core の readArtifact bound と同値**。超過はサーバが `file-too-large` で拒否するため到達しない）の成果物でも描画がブラウザを固まらせない。**1MB 超はリッチ描画せず plain preview 固定**（本 Unit 独自の閾値 — リッチ描画コストがリスクに見合わないため） | 大サイズ fixture（1MB 境界 + 10MB） |

## 予算の位置づけ

本 Unit の操作は**初回描画（NFR-2）にも変更反映（NFR-3）にも含まれない**（成果物を開くのはユーザーの明示操作）。したがって P-AV-* は独立した体感目標であり、dashboard-ui の P-UI 予算とは加算関係にない。

## Review

**Verdict:** READY

- **Criterion 1 (testability)**: All 5 performance rows (P-AV-1〜5) carry a concrete measurement method (バンドル解析 / 計測 / 大サイズ fixture) and a numeric threshold. All 5 security rows (S-AV-1〜5) carry a concrete verification method (呼出走査 / RTL / lint+fixture / 設定検査+fixture / エラーパステスト). None is a vague qualitative claim.
- **Criterion 2 (critical-path argument vs. dashboard-ui P-UI-1, no contradiction)**: performance-requirements.md:19's claim that this unit is excluded from NFR-2/NFR-3 addresses *runtime timing budget* membership (opening an artifact is a user-initiated action, not part of app boot or the WS-driven reflect path). This is a different axis from dashboard-ui P-UI-1's *bundle-size* budget ("バンドルは code-split（matrix/viewer は遅延）で初期 JS を小さく保つ", dashboard-ui/nfr-requirements/performance-requirements.md:10), which artifact-viewer's own P-AV-1 ("本 Unit…は初期バンドルに含めない…P-UI-1 の初期バンドル予算を侵さない", :11) and frontend-components.md:43 ("本 Unit は dashboard-ui から React.lazy で遅延ロード…P-UI-1") both actively satisfy rather than contradict — the two claims are complementary (bundle exclusion is *why* the runtime-budget exclusion holds), not overlapping claims about the same quantity.
- **Criterion 3 (security matches the real threat + functional-design)**: The 脅威メモ correctly names this unit as the sole renderer of untrusted-ish content ("唯一「外部由来の文書を描画する」場所…モブでユーザーが貼り付けた内容を含み得る", security-requirements.md:18) and S-AV-3/S-AV-4 map directly onto that threat (no `dangerouslySetInnerHTML`, Mermaid `securityLevel: strict`). S-AV-1 ("書込は POST /api/answer の1経路のみ") and S-AV-2 (hostMode → AnswerEditor not rendered, "サーバ 403 は最終防衛線") match business-logic-model.md D2's editable gate (`serverMode.hostMode === false`, business-logic-model.md:29) and frontend-components.md's AnswerEditor spec (:37), and are consistent with dashboard-server's 5-gate AnswerWriter (read-only-mode / not-a-questions-file / outside-record / not-an-answer-line / write-verification-failed) as summarized in the passed dashboard-server business-logic-model.md:34-46 — UI-side suppression and server-side rejection are correctly framed as double defense, not a substitute for one another.
- **Criterion 4 (tech-stack swap criteria are concrete)**: tech-stack-decisions.md:10 and decision-memo:18 both point to the same, already-defined trigger — the M3 five-point checklist in business-logic-model.md:9 (表の保持 / Mermaid 描画 / 構造保持 / 往復無欠落 / モード切替でクラッシュしない, any one failing → BlockNote → plain preview in that order). The blast radius of a swap is pinned to one file ("MarkdownSurface の実装ファイル1つ + tech-stack のこの行 + ADR-05 の追記のみ", tech-stack-decisions.md:18), matching ADR-05's stated isolation goal (decisions.md:42-43). Not vague.
- **Criterion 5 (structure)**: All three files carry ≥2 H2 sections and an upstream-input header line (`> 入力: …`).
- **[Non-blocking] P-AV-5's numeric thresholds are not traceable within this unit's own artifacts**: "10MB 上限" and the "閾値 1MB" plain-preview fallback (performance-requirements.md:15, tech-stack-decisions.md:19) appear only here — requirements.md's FR-6.1/NFR set has no byte-size figure, and business-logic-model.md D1 names the `file-too-large` error without a number (business-logic-model.md:16). Whether "10MB" actually matches reader-core/dashboard-server's `readArtifact` file-too-large threshold could not be checked in this pass (dashboard-server's own nfr-requirements/performance-requirements.md was not in the passed contract set for this review). Recommend confirming the two numbers agree in a follow-up spot-check; it does not block this unit's own design, which is internally consistent and independently testable either way.
- **[Note, not a defect] P-AV-2's "サーバ P-DS 系" citation** (performance-requirements.md:12) references dashboard-server's server-side budget by label only; that file was outside this review's read scope, so the citation is taken at face value rather than independently verified.
