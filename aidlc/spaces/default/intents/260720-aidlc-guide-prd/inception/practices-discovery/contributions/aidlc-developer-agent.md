**Collaborator:** aidlc-developer-agent

## Contribution

DEVELOPER / code-style レンズでの評価。lead 草案の `## Code Style`（team-practices.md 43–49行）は命名・formatter・クロスプラットフォームを押さえているが、**構造（レイヤ境界）と解析境界のエラー規約**が抜けている。これらは code-style というより「後で直すと高コストな骨格の約束」で、PU-01(reader-core) を最初の Bolt にする以上、interview で先に固定すべき。以下は lead が Code Style 節へ統合できる形で提示する。

### 1. レイヤ境界 — reader-core は UI 非依存（統合推奨・最重要）

intent-backlog の PU-03(mcp) / PU-05(dashboard) / PU-12(mob) はいずれも PU-01 に依存する「1 library / 3 surfaces」。**reader-core は React・MCP SDK・HTTP/WebSocket を一切 import しない純データ層**とし、3サーフェスはこれを消費するだけ、という依存方向を規約化する。逆流（reader-core が UI 型を参照）は禁止。これを最初の Bolt で境界として敷いておかないと、後発の mob-mode が dashboard 経由でしか動かない密結合になる。

- 提案文: 「reader-core は UI/トランスポート非依存。MCP・Dashboard・Mob は reader-core を一方向に消費する。逆依存禁止。」

### 2. パーサ isolation を「モジュール境界」として明文化（統合推奨）

discovered-rules.md は State Version 検知＋解析不可フォールバックの**振る舞い**を Mandated 化しているが、**構造規約**（NFR-6/C-T3 のバージョン耐性 = パーサを差し替え可能な単一モジュールに閉じ込める）が team-practices 側にない。State Version が上がったときに触る箇所を1モジュールに限定する、という約束を Code Style に足す。

- 提案文: 「state/成果物パースは単一モジュール（例 `reader-core/parse/`）に隔離。State Version 依存のロジックはここ以外に漏らさない。」

### 3. 解析境界のエラー規約 — throw ではなく typed result（統合推奨）

fail-soft「解析不可」フォールバック（NFR-6）を**どう返すか**が未定。construction.md ガードレール（統合境界でのエラー処理必須・silent failure 禁止）と整合させ、reader-core の公開パース関数は**判別可能ユニオンを返し、境界を越えて throw しない**方針を lock する。UI 側は `unsupported` を握って「解析不可」画面（discovered-rules の explicit unsupported state）を出すだけにできる。

- 提案文: 「パース公開APIは `{ ok } | { unsupported, version } | { error, reason }` の判別ユニオンを返す。reader-core 境界を越えた例外送出は禁止。ファイル欠落・不正 state は握り潰さず unsupported/error として表現。」

### 4. ファイル/ディレクトリ構成（interview で確定）

「1 library / 3 surfaces」は bun workspace（`packages/reader-core` + surface ごとのパッケージ）が自然だが、13 proto-unit・ローカル専用ツールに対しては**過剰分割注意**。core=1 パッケージ + surface ごと、程度で十分（surface をさらに割らない）。単一パッケージ内 `src/reader` `src/mcp` `src/dashboard` でも要件は満たす。どちらでも良いが、PU-01 の Bolt がレイアウトを既成事実化するので interview で1つに決める。lazy 既定としては **bun workspaces（core を genuine な共有依存として1パッケージに切る）** を推す — 3サーフェスが本当に別プロセス（stdio MCP / Vite / WS）だから境界が実利になる。ファイル名は kebab-case（TS慣習・大小混在FS事故回避）を1つに固定推奨。

### 5. formatter/linter は「1つに決め切る」（下記 OBJECT 参照）

## Positions

AGREE: 命名規則（TS camelCase / 型・コンポーネント PascalCase, team-practices 47行）。

AGREE: クロスプラットフォーム規約（`path.sep` 決め打ち禁止・Windows Git Bash / macOS 両対応, 48–49行）。discovered-rules の C-T4 と整合。追加で「プロセス spawn とパス結合は node:path / bun の cross-platform API 経由」を1行足すと親切。

OBJECT: 「Prettier + ESLint、または `bunfmt` があればそれを優先」（team-practices 45–46行）。(a) `bunfmt` は現存する正式ツールではない（bun の formatter は未確立） — 実在しない選択肢に条件分岐しており interview を混乱させる。(b) 「あれば優先」は greenfield（設定ファイル皆無, evidence.md 47行）では条件が永遠に成立せず宙に浮く。**lazy 既定として Biome を推奨**: bun+TS で format+lint を単一依存・単一設定で賄え、Prettier↔ESLint 競合の調停プラグインが不要。Biome が要件に届かない具体理由が出た時だけ Prettier+ESLint に落とす。いずれにせよ「あれば優先」ではなく **interview で1本に決め切り、PU-01 Bolt で設定ファイルをコミットする**こと。

OBJECT: `## Code Style` にレイヤ境界（Contribution 1）・パーサ isolation（同 2）・解析境界エラー規約（同 3）が欠落。command/behavior は discovered-rules にあるが、**構造の約束が team-practices 側に無い**。最初の Bolt が骨格を固定する前に interview で明文化すべき最重要項目として追加を要望する。
