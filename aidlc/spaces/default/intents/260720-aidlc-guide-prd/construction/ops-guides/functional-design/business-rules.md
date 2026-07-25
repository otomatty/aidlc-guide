# Business Rules — Unit: ops-guides

> functional-design (3.1) / Unit: ops-guides (kind: spec, S — コード外の文書成果物) / 2026-07-25
> 入力: unit-of-work.md U9 + unit-of-work-story-map.md（US-12/US-22）+ requirements.md（FR-8.1/8.2, NFR-7）+ components.md C8（必須収録項目）+ decisions.md ADR-04
> 注: kind:spec のため produces は business-rules + domain-entities（実行コードを持たないため business-logic-model は非対象）。

## 成果物（`docs/guides/` 配下の2文書）

| ID | 文書 | 対応 |
|----|------|------|
| G-1 | `docs/guides/live-share.md` — Live Share 運用ガイド | FR-8.1 / US-12 |
| G-2 | `docs/guides/async-sharing.md` — 非同期共有規約 | FR-8.2 / US-22 |

## ルール（記載義務）

| ID | ルール | 出所 |
|----|--------|------|
| BR-OG-1 | **G-1 に「モブ中の回答記入」節を必ず設ける**（`--host` 中はドライバーも Dashboard から記入できない → 口頭合意 → ドライバーが本線セッション or `--host` 停止後に記入）。ADR-04 が受容したトレードオフの受け皿であり、省略不可 | components.md C8 / ADR-04 / BR-MM-7 |
| BR-OG-2 | **トンネル公開（cloudflared/Tailscale 等）は手順 + 認証注意をセットで書く**（ツール本体は認証を持たないため、公開前に認証を掛ける責任が運用側にあることを明記） | FR-7.4 / NFR-7 |
| BR-OG-3 | **Live Share の read-only ターミナル共有設定を具体的に書く**（`liveshare.autoShareTerminals` 等の設定名と、read-only で共有すべき理由） | FR-8.1 |
| BR-OG-4 | **G-2 は「ゲート通過時 push」と「checkout 不要閲覧」の両手順を書く**（`git fetch` + `git show origin/<branch>:<path>`）。フックはサンプルをそのまま貼れる形で載せる | FR-8.2 / US-22 |
| BR-OG-5 | **代替手段を必ず併記**（Live Share が組織ポリシーで使えない場合の tmux 共有 / Dashboard 単独運用 — feasibility のリスク対応どおり） | PRD §11 リスク表 |
| BR-OG-6 | **ツールの実挙動と食い違う記述をしない**: 警告文言・`--host` の効果・403 の条件は mob-mode の実装（U8）を参照して書き、実装変更時はガイドも更新する（同期義務） | 整合性 |
| BR-OG-7 | 手順は**コピペで実行可能**な粒度（コマンド・設定キー・期待される出力を具体的に）。抽象的な方針だけの記述は不可 | 実用性 |

## 検証可能な受入条件

- G-1 に「モブ中の回答記入」節が存在し、ADR-04 の制約と回避手順が書かれている（BR-OG-1）
- G-1 のトンネル節に認証注意が含まれる（BR-OG-2）
- G-2 の手順どおりに実行して、ゲート通過で push され、参加者が checkout 無しで成果物を閲覧できる（US-22 AC の実行検証）
- 両ガイドに代替手段の節がある（BR-OG-5）
- 記載された警告文言が mob-mode の実装文言と一致する（BR-OG-6 — 実装後の突合）
- **各コマンド節にコピペ可能なコマンドと期待される出力が併記されている**（BR-OG-7 — 抽象的な方針だけの節が無いこと）

## Review

**Verdict: READY**

- **C8 必須項目の継承（check 1）** — components.md C8 の「モブ中の回答記入」節義務は BR-OG-1 に非オプションのルールとして転記され、`docs/guides/live-share.md`（G-1）という具体的な収録先が名指しされている。domain-entities.md の G-1 構造にも同節が **必須節** として明記され、必須要素チェックリストの1行目にも対応がある。ADR-04（decisions.md）→ C8 → BR-OG-1 → G-1構造 の traceability は双方向で具体的。
- **FR-8.1/8.2・US-12/US-22 カバレッジ（check 2）** — requirements.md FR-8.1 AC（ワークスペース共有 + read-only ターミナル）は BR-OG-3 + G-1 の「セットアップ」「ターミナルの read-only 共有」節で、FR-8.2 AC（ゲート通過 push + checkout 不要閲覧）は BR-OG-4 + G-2 の該当節でそれぞれ回収されている。unit-of-work-story-map.md の「US-12（Live Share+トンネル、ADR-04節含む）→US-22（非同期共有）」の割当ともG-1/G-2の分割が一致する。
- **FR-7.4 / NFR-7（check 3）** — トンネル公開手順+認証注意は BR-OG-2 で明示ルール化され、G-1 に専用節「リモート参加（トンネル公開）」として構造化されている。NFR-7 の「トンネル公開時の認証は運用ガイドで注意喚起」という要求と文言レベルで対応。
- **受入条件の検証可能性（check 4、部分的な gap あり）** — BR-OG-1/2/4/5/6 は business-rules.md の「検証可能な受入条件」に対応するチェック項目があり、BR-OG-3 は domain-entities.md の必須要素チェックリストでカバーされる。ただし **BR-OG-7（コピペで実行可能な粒度）だけは、どちらの文書のチェックリストにも対応する受入条件行がない** — 定性的なルールではあるが、他の6ルールが一貫してチェックリスト化されているパターンから外れている。ブロッカーではないが、次回改訂で「G-1/G-2 の各コマンド節にコマンド+期待出力が併記されているか」程度の1行を検証可能な受入条件に足すことを推奨。
- **U8 依存/順序メモの整合性（check 5）** — domain-entities.md「依存とタイミング」節（G-1はU8完了後・bolt-plan B7で同一Bolt、G-2は先行着手可）は、unit-of-work.md の resolved 注記（「U9の注記はU8エッジがUS-12半分のみを縛ると述べ、US-22はgit-onlyで独立」）および bolt-plan.md Bolt 7（`U8 mob-mode + U9 ops-guides` を同一Boltに配置）と矛盾なく一致する。
- **構造要件（check 6）** — business-rules.md は H2 3節（成果物/ルール/検証可能な受入条件）、domain-entities.md は H2 4節（G-1構造/G-2構造/必須要素チェックリスト/依存とタイミング）。両文書とも冒頭に upstream 入力（unit-of-work.md, unit-of-work-story-map.md, requirements.md, components.md, decisions.md）を明記しており基準を満たす。
- **kind:spec の produces 制約** — 両文書とも header で business-logic-model 非対象と明記しており、コード外文書ユニットとして整合。
