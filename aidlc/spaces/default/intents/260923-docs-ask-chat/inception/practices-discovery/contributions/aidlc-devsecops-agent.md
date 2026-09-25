**Collaborator:** aidlc-devsecops-agent

## Contribution

DevSecOps 観点（lint/format・SAST/DAST・秘密情報／依存スキャン・供給鎖）でリード草稿を再確認した。本プロジェクトは local-only（クラウド／ステージング／CD なし）であり、制御面は **単一ゲート `bun run check`** と **パッケージ衛生** に集約されている、というリードの枠組みに同意する。

### Lint / Format

- Code Style（oxlint + oxfmt、Biome/Prettier 不使用）と「新しい検査は `bun run check` に配線」は、`code-quality-assessment.md` / `evidence.md` / `project.md` と一致。**新規の lint ツールや第二ゲートを発明しないこと**を支持する。
- `project.md` Code Style の「安全性不変条件は単一 enforcement point + oxlint `no-restricted-imports` 等で構造的に禁止」は既に肯定済みの実践であり、本 intent で再発明は不要。チャット画面化でも `guardPath` 非経由読取や write 系 fs の勝手な経路追加は禁止のまま。

### SAST / DAST（local-only に合わせた妥当範囲）

- 専用クラウド SAST（CodeGuru 等）や DAST／侵入試験用ステージングは、local-only かつ CD なしの前提では **意図的に対象外**でよい。リードがこれらを新規 Mandated にしていない点に同意する。
- 実質の AppSec 静的制御は既にゲート内にある: oxlint、型検査、`guardPath` + 否定 containment テスト、パッケージ境界（dashboard ↛ reader-core）。DAST の代替は「拡張ホスト in-process / loopback 既定」であり、公開 URL への継続スキャンは不要。
- ギャップとして明示しておくべきなのは、**専用 SAST/DAST を後段で足さないこと**を Practices 上の合意として残すこと（沈黙すると NFR/CI ステージで過剰ゲートが提案されやすい）。新規硬規則の発明ではなく、Deployment / Testing の再提示か `evidence.md` Uncertain の注記で足りる。

### 秘密情報スキャン

- 「VSIX に秘密情報・`.env`・`aidlc/` ランタイム状態を含めない」Mandated は継承必須。同意。
- `bun run check` の観測構成（lint / format / typecheck / docs-index / workflows-compatibility / test:coverage / audit-shards / **audit**）に **専用 secret scanner（gitleaks 等）は含まれない**。local-only ではパッケージ衛生 + ロックファイル + audit で残存リスクを受け入れるのが妥当で、**今 intent で secret scanner を新 Mandated にしない**。ただし Evidence の Uncertain か Deployment 節で「専用 secret scan はゲート外・受容」と一文残し、沈黙ギャップにしないこと。

### 依存スキャン / 供給鎖

- `ALWAYS` bun ロックファイルをコミットする／`ALWAYS` ローカルゲートで `bun audit`（または `bun pm audit`）し直接依存の既知脆弱性を lint 同等に落とす — いずれも `dependencies.md`・`project.md`・`discovered-rules.md` と一致。**強い同意・維持必須**。
- `NEVER` クラウド／AWS SDK・アカウント管理を足さない、とも一致。docs-qa の外部 AI CLI は「プロセス起動であり SaaS SDK ではない」と dependencies が述べており、**クラウド依存 Forbidden を破る根拠にしない**。CLI 資格情報やプロンプトにユーザ貼付秘密が混ざる可能性は運用上の開示面だが、本 Practices 草稿の硬規則発明対象外（既存 VSIX／秘密衛生と loopback 既定で十分）。

### discovered-rules へのセキュリティ再掲漏れ

リードは「既に書かれ明確に強制されているもののみ」と正しく自制しているが、セキュリティ上いまも適用される `project.md` Mandated の再掲が供給鎖・docs 衛生に偏り、次が落ちている:

- **Mob / dashboard-server は既定で loopback（`127.0.0.1`）bind**；LAN 露出は明示 `--host` + 起動警告（aidlc 成果物に貼付秘密が載り得る）。チャット UI が副経路の dashboard-server に触れるなら、再発見セットから落としてはならない。
- （参考）State Version 未対応の明示拒否・クロス OS パスはセキュリティ隣接だが、リードがクロスプラットフォーム ALWAYS を既に再掲している点は十分。

新規発明ではなく、**既存肯定済みセキュリティ Mandated の脱落防止**として OBJECT する。

### team-practices Deployment

local-only、リリース＝squash-merge／タグ、ロールバック＝revert／前タグ、VSIX 衛生 — いずれも同意。CD／クラウド DAST ゲートを足す提案はしない。

## Positions

AGREE:

- oxlint + oxfmt を Code Style とし、品質の単一入口を `bun run check` に保つ（第二ゲート・Biome/Prettier を導入しない）。
- 供給鎖: bun ロックファイルコミット + `bun audit` を Mandated のまま維持する。
- VSIX から秘密情報・`.env`・`aidlc/` ランタイム状態を排除する Mandated を維持する。
- local-only のため専用クラウド SAST／DAST／CD セキュリティゲートを新規 Mandated にしない。
- クラウド／AWS 依存 Forbidden を維持し、外部 AI CLI を SaaS SDK 導入の抜け道にしない。

OBJECT:

- 専用 SAST/DAST を「未記載＝後で足してよい」と読まれないよう、local-only では oxlint＋containment＋`bun audit`＋パッケージ衛生が AppSec 制御面であること（専用 SAST/DAST は対象外）を team-practices の Deployment／Testing か evidence Uncertain に明示する。新規硬規則の発明は不要。
- 専用 secret scanner 不在を沈黙させず、「ゲート外・local-only として受容；今 intent で Mandated 化しない」を Evidence Uncertain または Deployment 追記で残す（gitleaks 等の新 Mandated は提案しない）。
- `discovered-rules.md` の Mandated 再掲に、`project.md` 既存の **Mob/dashboard-server 既定 loopback bind（`--host` 時は警告必須）** を落とさず含める。docs-ask-chat の副経路と秘密開示面に直結する既存規則であり、供給鎖条項だけ残してこれを省略すべきではない。
