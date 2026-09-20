# Doctor output fixtures

The `ok`, `warning`, and `failed` fixtures pin the verbose, color-free `humanReport` format
from `aidlc-doctor.ts` in AI-DLC 2.8.0 and 2.8.1. They are constructed examples
using labels and remedies from `aidlc-utility.ts` and `aidlc-doctor-bundle.ts`;
they are not full reports collected from a user's computer.

`v2.8.2-source-ok.txt` and `v2.8.2-source-failed.txt` are constructed examples
of the new workspace source boundary checks and the revised project-pin remedy
in release tag `v2.8.2`. The tag's `aidlc-doctor.ts` human renderer is unchanged
from 2.8.0 and 2.8.1. The source checks and remedies come from
`core/tools/aidlc-utility.ts`; the fingerprint and path are sample values.
The failed report preserves the full human-only Plan Approval override remedy.

`v2.8.2-source-failure-variants.txt` collects all 38 distinct failure templates
from `noteSourceFailure` calls in release `v2.8.2`'s `core/tools/aidlc-lib.ts`,
covering all 15 `WorkspaceSourceFailureCode` values. It uses the label renderer
from `core/tools/aidlc-utility.ts`. Paths, counts, and OS/parser errors are sample
values; one real doctor run emits only the first source failure, rather than
this aggregate. Original OS/parser error details remain explicitly labelled in
the Japanese output.

`v2.8.0-source-empty-project.txt` is a complete report captured on Windows on
2026-09-11 by running the bundled 2.8.0 source doctor with
`--verbose --no-color` against an empty temporary project, with non-interactive output. The user
home path was replaced with `C:\Users\example`. It includes 48 checks and exits
with code 1, reporting three problems and one warning.

The `state-audit-drift` finding has internal severity `error`, but the human
renderer emits it as `warn` and includes it in the warning footer. JSON report
counts omit that extra finding. The parser must preserve the human result.

Before adding a supported version, compare its renderer with these fixtures,
including section order, verdict padding, fixes, findings, and footer counts.
# v2.9.0 の実採取

`captured/2.9.0/` は公式タグとネイティブ配布物から採取した Windows・macOS・Linux の各 9 ケースです。採取コマンド、公式 SHA、Bun / ネイティブ実行ファイルの SHA-256、stdout / stderr / 期待値のハッシュは `data/doctor-compatibility.json` に記録します。対応版はこのレジストリから導出します。

`scripts/capture-doctor-fixtures.ts` が一時ホーム・設定・プロジェクト・インストール先で実プロセスを実行します。外部 CLI の `--version` と非対話 PATH の取得だけはテスト用の実行ファイルで制御し、AI-DLC 自体は公式のコードを使います。`<CAPTURE>` は一時ディレクトリ、`<BUN>` / `<BUN_DIR>` は Bun の場所です。空白と日本語を含むプロジェクト名は残します。

期待値は上流の verbose JSON の診断と `runDoctorAnalysis` の追加警告から作ります。Guide の parser の出力は期待値の生成に使いません。`analysis-warning` は JSON に含まれない警告を実際に発生させるケースです。ネイティブ版の追加警告に未対応の oracle 条件が現れた場合は、採取器が失敗します。

このディレクトリの採取ファイルは採取器が整形も管理し、oxfmt の対象外です。手で診断文や期待値を直してゲートを通さず、実行環境・parser・翻訳を修正して再採取してください。専用 CI は再採取物と登録済みのハッシュも照合します。

上記の 2.8.x の組み立て例は旧版の回帰用に保持します。新版の実採取として扱いません。
