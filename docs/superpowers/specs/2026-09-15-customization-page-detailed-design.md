# カスタマイズページ 詳細設計

日付: 2026-09-15
状態: 実装済み。本文は合意した詳細設計の記録。実際のモジュール構成・検証結果・導入条件は[実装記録](../../maintenance/customization-implementation.md)を参照。
調査対象: aidlc-guide の現チェックアウト、aidlc-workflows 2.8.2、State Version 8。
上位仕様: [カスタマイズページの基本設計](2026-09-14-customization-page-design.md)

## 1. 設計の結論

フォーム、AI提案、設定ファイルの読み込みを、一つの下書き更新サービスに集約する。正式な設定への書き込みは、差分確認後の適用処理だけが行う。IDEとローカルブラウザーは同じサービスを使う。

設定の原本は、既存のルール・チーム資料、標準プラグインの原本、既存定義への変更を保持するGuide用ファイルに分ける。工程実行・承認・進捗管理は既存のaidlc-workflowsが引き続き担当する。

現行2.8.2だけでは、次の二つが不足する。本書では必要なエンジン連携として設計し、対応済みとは扱わない。

1. 既存工程・scope・エージェントなどへの変更を、全ハーネスへ生成し、上流更新後も再適用する正式な入力。
2. 設定の適用とワークフローの開始・再開を調整し、適用中の強制終了後も部分更新を読ませない仕組み。

2026-09-15の利用者の選択により、この二つをエンジン側の共通機能として追加し、Guideが呼び出す構成を採用する。Guide側で生成・更新アダプターを持つ代案との比較と、採用した責務分担は第14節に記載する。確認済みの編集範囲を維持し、必要なエンジン開発を実装範囲に含める。

## 2. 適用範囲と不変条件

- 「カスタマイズ」はステージ一覧・効果測定・ドキュメント・設定と同じ階層に置く。開発者向けの一つの画面とし、管理者モードは作らない。
- 一つの実ワークスペースにつき下書きは一つ。IDEと同じフォルダーを開いたローカルブラウザーは、その下書きを共有する。別のcloneや独立したworktreeには、それぞれの下書きがある。
- 下書きは最初に選んだspaceを保持する。既存のIntentPickerや`active-intent`を変えても、下書きの対象は変えない。未適用変更がある間に別spaceへ編集対象を変更する場合は、今の下書きを適用するか破棄してから切り替える。
- space内のルール・チーム資料と、全spaceが共用する工程・プラグインを区別して適用範囲を表示する。初版の正式適用条件は保守的に、同じ設定ルートに属する全spaceの未完了ワークフローがゼロであることとする。
- 下書き保存、設定の構造検証、差分確認、配布ファイル生成はワークフロー進行中も利用できる。正式適用だけを終了後に制限する。
- AIは変更案を生成する。利用者が「下書きに取り込む」を押すまで下書きを変えず、「適用」を押すまで現行設定を変えない。
- 試行用ワークフロー、単独工程の起動、成果物生成、テスト・センサーの試し実行は追加しない。
- 読み込みや適用の失敗で、利用者の編集中の内容を消さない。通信応答が失われても同じ操作を二度適用しない。
- 初版の書き込み対象はワークスペース内の通常の設定配置とする。環境変数やリンクで外部の設定を共有している場合は、参照先を説明して適用を停止する。外部ルートへの書き込み対応は、利用者と排他制御の範囲を別途設計する必要がある。

## 3. 画面と遷移

### 3.1 ページ全体

Headerの既存destination一覧へ「カスタマイズ」を追加する。既存の`AppState`・reducerに開閉操作を追加し、ほかの最上位ページとの同時表示を防ぐ。Intentが存在しないプロジェクトでも、エンジンが導入済みならカスタマイズへ入れる。未導入の場合は「設定」の導入操作へ案内する。

ページ上部にプロジェクト名、対象space、保存状態、未適用変更数を置く。主操作は「下書きを保存」と「変更を確認」。適用ボタンは差分確認画面に置き、編集中の画面から直接適用しない。

| ページ本文の幅 | 表示 |
| --- | --- |
| 1040px以上 | 左カテゴリ160px、中央編集、右AIチャット320px |
| 760〜1039px | カテゴリを上部の選択欄へ移し、編集とAIチャットを横並び |
| 760px未満 | 「編集／AIチャット」のタブ切替。編集タブ内にカテゴリ選択欄を置く |

幅はウィンドウ全体ではなくページ本文を基準にする。上記は実装時の初期値で、320px幅でもラベルと操作が欠けないことを確認する。Header自身の既存レスポンシブ規則は独立して維持する。

カテゴリを開くと、そのカテゴリの項目一覧と編集フォームを表示する。狭い画面では「項目一覧→項目編集」の一段の遷移とし、戻る操作で一覧の位置を復元する。新規作成、複製、削除予定、標準設定へ戻す操作は項目の所有者と参照関係に応じて提供する。

### 3.2 編集とAIの行き来

フォーム、会話、未送信メッセージ、選択項目、job IDはタブより上の状態管理に置く。表示切替で初期化しない。スクロール位置は編集項目・チャットそれぞれに保持する。タブは矢印キーで移動でき、非表示パネルをフォーカス対象から外す。

AI提案には、対象項目、変更理由、サーバーが計算した変更前後を表示する。取り込み後の「編集画面で見る」は該当項目を開き、狭い画面では編集タブを選択する。提案を取り込んだだけではタブを強制的に切り替えない。

### 3.3 差分確認

差分画面は「変更の要約」と「ファイル差分」を提供する。要約には追加・変更・削除予定の項目、対象space、影響する工程・エージェント・scope、標準プラグインに書き出せない内容を表示する。影響は定義の参照関係から算出し、AI出力への影響を予測できるとは表示しない。

生成済みファイルの差分は原本の変更と区別し、初期表示では折りたたむ。利用者は適用される全ファイルを展開して確認できる。検証エラーがある場合も差分を読めるが、適用はできない。

「適用」には確認中の下書きrevisionを結び付ける。確認中に編集、外部設定変更、エンジン更新、プラグイン選択変更が起きた場合は、以前の確認を使い回さず「変更内容が変わりました」と表示する。

## 4. カテゴリ別の編集モデル

フォームの値を生成済みJSONへ直接書き込まず、エンジンの原本に相当する編集モデルへ変換する。知らないfrontmatterや本文は元の位置・内容を保持する。変更していない文書全体を再整形しない。

### 4.1 開発ルール

| 項目 | 仕様 |
| --- | --- |
| 適用層 | org・team・project・phase。phaseは既存の4フェーズから選ぶ |
| ルール | 既定のmemoryファイル内の章見出しとMarkdown本文。任意のルールファイルを増やさない |
| 詳細 | ファイル単位の`pairing`、`status`、`stale_after`。章単位の属性として保存しない |
| 保存先 | `aidlc/spaces/<space>/memory/org.md`、`team.md`、`project.md`、`phases/<phase>.md` |
| 配布 | Guide形式。標準プラグインでは非対応 |

既存の`##`章を一つの編集項目として扱う。冒頭の本文、別の章、未知のメタデータは変更範囲外として保持する。重複見出しや解析できない構造は、誤った章を編集せずファイル全体の原文編集へ案内する。

Guide内の章IDとファイル・章の対応は識別情報として保存する。外部で章名や構造が変わり、一意に対応付けられなくなった場合は競合として確認する。見出しの文字列だけで別の章を上書きしない。

`status: draft/deprecated`は上流の診断用メタデータであり、実行時の無効化ではない。「ルールを無効化する」スイッチには使わない。自然文の矛盾は構造検証で保証できないため、重複・関連章を表示し、必要に応じてAIへ相談できるようにする。

### 4.2 ナレッジ

| 種類 | 編集内容と扱い |
| --- | --- |
| チーム資料 | タイトル、Markdown本文、共有先の全エージェントまたは指定エージェント。既存`knowledge/aidlc-shared/`または`knowledge/<agent>/`を使う |
| 資料原本 | 文書ファイルの追加と参照。`knowledge/documents/`へ置き、PDF・Wordなどの本文はGuideフォームで書き換えない |
| DocumentKB | 既存カタログから参照する。抽出本文・metadata・indexを直接編集しない。原本追加に伴う登録は既存DocumentKBの機能へ委譲する |
| プラグイン資料 | 方法論として配布するMarkdown。`plugins/<name>/knowledge/`の原本を使う |

チーム資料、DocumentKBの資料、プラグインの方法論資料は異なる保存・参照規則を持つ。エージェントの`examples`を任意資料の参照欄として流用しない。資料の原本を削除する操作と、参照から外す操作を分け、派生カタログの削除で原本を管理しない。

knowledgeのpayloadは`team-markdown / plugin-markdown / document-source / document-reference`の判別型にする。チームMarkdownの共有先は、一つの原本につき「全エージェント」または「一つの指定エージェント」とし、既存のディレクトリ規則に対応付ける。複数の指定先へ同じ内容を配る場合は、各原本を明示的に複製して選択する。一つのファイルを複数エージェントが自動参照する新しい規則を暗黙に追加しない。

配布用資料IDとDocumentKBのローカルIDは別にする。原本を同梱した資料は配布先で新しいローカルIDへ登録し、選択した参照を対応表で付け直す。参照だけを配布する場合は配布先の資料との対応を確認し、元プロジェクトのDocumentKB IDやintent IDをそのまま流用しない。

資料ファイルを取り込むときは下書き用領域へ保持し、正式適用前に既存の原本を上書きしない。既存資料を配布するときも、利用者が選んだ資料だけを含める。ワークフローの状態・監査・成果物一式を自動的に同梱しない。

### 4.3 ワークフロー

工程とscopeを二つの一覧に分ける。全体を自由配置する図形エディターは初版に作らず、工程一覧、前提工程の選択、参照関係の表示で編集する。表示順のドラッグだけで実行順が変わるUIにはしない。

| 工程の項目 | 対応する定義 |
| --- | --- |
| 識別子・表示名・フェーズ・本文 | `slug`、`name`、`phase`、Markdown本文 |
| 実行条件 | `execution`、`condition`。自然文の条件と機械判定可能な条件を区別 |
| 担当と協働方式 | `lead_agent`、`support_agents`、`mode` |
| 成果物 | `produces`、`optional_produces`、`consumes`。入力ごとの必須指定と対応する条件 |
| 前提工程・所属scope | `requires_stage`、`scopes` |
| 品質チェック | `sensors` |
| レビュー | `reviewer`、`review_artifact`、`reviewer_max_iterations`、`review_class` |
| 詳細 | `for_each`、`workspace_requires`、`produces_kinds`、`summary_confirmation`、入力・出力説明 |

scopeは名前、説明、depth、testStrategy、review_capを基本項目とし、keywords、skeleton、runner、freeform_default、change_controlを詳細項目に置く。所属工程の変更は各工程の`scopes`へ変換する。scope-gridを直接編集しない。

新規工程・scopeは所有プラグインを持つ。既存工程の担当・依存・レビュー設定の置換や、既存scopeからの工程除去はGuide用の変更定義として管理する。初期化工程や必須の承認機構など、エンジンが必須とする制約を通常の工程編集で壊せないよう、対応版の検証規則を使う。

`agent-team`など予約された方式や、現行で評価されない`when`を利用可能な機能として選ばせない。既存ファイルに含まれる場合は内容を保持し、未対応であることを表示する。`required_sections`だけでは見出しの存在を強制できないため、機械的に検査する場合は対応する成果物テンプレートとセンサーも必要な設定として扱う。

成果物の編集欄に`artifact-template`を設け、成果物ID、対象space、Markdown本文を保持する。保存先は`aidlc/spaces/<space>/memory/templates/<artifact>.md`。質問ファイルや時刻を含むマーカー等を除く上流のtemplate適格性と、required-sectionsセンサーのbindingを検証する。見出し検査を選んだ場合はテンプレートとbindingも同じ下書きに含め、利用者に変更を示す。テンプレートの配布はGuide形式で扱う。

### 4.4 エージェント

識別子、表示名、説明、責務・作業方針の本文、tierを編集する。tierは`judgment/balanced/templated`を使い、特定モデル名の指定とは区別する。詳細項目は対応ハーネスで有効なtools制限などに限定し、適用先で無視される値を機能する設定に見せない。

担当工程を変更する操作は、工程の`lead_agent/support_agents/reviewer`の変更として同じ下書きに含める。エージェントの説明だけ変えて割当が変わったように表示しない。参照中のエージェントの削除は、参照変更がそろうまで適用を止める。

### 4.5 品質チェック

id、description、category、command、fire_on、default_severity、matches、timeout_seconds、対象工程を編集する。必要なスクリプトはプラグインの`tools/`原本として編集・配布する。commandやスクリプトは検証・書き出し・適用時には実行しない。

対象工程は工程側の`sensors`へ保存する。blockingはgate時に進行を止める指定であり、write時にも同じ強制力があるとは表示しない。現行パーサーが使わない`input_schema/output_schema`を有効な実行契約として編集させない。

### 4.6 プラグイン

名前、version、説明、author、dependencies、含める項目、配布形式、対象ハーネスを編集する。名前・runtime識別子・成果物名の変更で参照先も変わる場合は、全変更を一つの差分として示す。

「削除」は所有する追加項目の削除予定、「標準設定へ戻す」はGuide用の既存定義変更の解除として区別する。第三者プラグインの管理ファイルを黙って自分の所有物にしない。所有元の原本がない場合は、配布物を原本として採用できるか確認するまで、その項目の正式変更を止める。

新しい工程・scope・エージェント・センサー・tool・方法論資料は、作成時に所有プラグインを決める。操作は「所有原本を編集」「core定義への変更を作成」「第三者定義を明示的に複製」に分ける。第三者原本をそのまま編集する場合は所有名を維持し、複製する場合は新しい名前空間と参照の変更を差分に含める。

## 5. 原本・下書き・生成物の保存

以下は新設する構成案。現在のエンジンが既に読んでいるパスではない。

```text
aidlc/
  spaces/<space>/memory/                     既存のルール原本
  spaces/<space>/knowledge/                  既存のチーム資料・文書原本
  guide-customization/
    manifest.json                           設計形式、原本の参照、対応エンジン
    identities.json                         項目ID、章と原本の対応
    overrides/<kind>/<id>.json               既存定義への変更と基準情報
    .local/
      draft.json                            唯一の下書き、revision、再送記録
      blobs/<sha256>                        下書きが参照する文書等
      conversations/<id>.json                会話と確定した提案
      jobs/<id>.json                        AI・書き出し等の状態
      requests/<id>.json                    受付・再送・操作結果の対応
  .aidlc-config-runtime/                    エンジンとの共通契約で新設
    current.json                            現在のcommitと設定revision
    pending.json                            適用・復旧待ちtransaction
    operations/<id>.json                     record外のoperation lease
    transactions/<id>/                       適用計画、変更前後の内容、復旧記録
plugins/<name>/
  .aidlc-plugin/plugin.json                  標準プラグインの原本
  stages/ contributions/ scopes/ agents/
  sensors/ tools/ knowledge/
```

ルール本文はmemory内のファイルを原本とし、Guide用ディレクトリへ別の編集用原本を複製しない。下書きと復旧用コピーは原本ではない。新規の工程などは標準プラグインの原本を使い、既存core定義の置換だけを`overrides`へ保存する。

overrideには、対象kind/runtime ID、基準エンジン版・生成器版、基準hash、基準内容または取得保証のある不変source参照、型付き変更集合を保存する。hashだけから基準本文を推測しない。再生成に必要な基準は別cloneでも解決できるものにし、取得できない場合は更新・適用を停止する。

manifest、identities、overrides、プラグイン原本、既存のmemory・knowledgeはGit管理対象とする。`.local/`と`aidlc/.aidlc-config-runtime/`は除外する。下書きや会話を別プロジェクトへ移すためにGitへ入れず、利用者が選択した設定を配布形式へ書き出す。実装時にはこの除外を生成するが、本設計作業では`.gitignore`を変更しない。

`.claude/`や`.cursor/`等の工程定義、stage-graph、scope-grid、runner、生成側モデル設定は出力として扱う。Guideが管理する変更は原本から再生成する。使用中のハーネスを一つだけ更新して完了とはしない。

## 6. データ契約

次は新規型の骨格。実装時にはkindごとのpayloadを判別可能な型と実行時schemaで定義し、自由な`Record<string, unknown>`を書き込みAPIの契約にしない。

```ts
type CustomizationKind =
  | "rule-section" | "rule-file-metadata" | "knowledge"
  | "stage" | "scope" | "agent" | "sensor" | "tool" | "plugin"
  | "artifact-template";

type ItemIdentity = {
  id: string;                  // Guide内の安定ID。パスではない
  kind: CustomizationKind;
  owner: "core" | "plugin" | "project";
  pluginId?: string;
  runtimeId?: string;
  spaceId?: string;            // 省略時はworkspace共通
};

type DraftHeader = {
  schemaVersion: 1;
  id: string;
  revision: number;
  spaceId: string;
  baseConfigurationRevision: string;
  engineVersion: string;
  capabilityProfile: string;
  updatedAt: string;
};

type MutationHeader = {
  requestId: string;
  draftId: string;
  expectedDraftRevision: number;
};

type FileChange = {
  relativePath: string;        // サーバーが生成する。クライアント入力ではない
  beforeHash: string | null;
  afterHash: string | null;
  contentRef: string | null;
  itemIds: string[];
};
```

下書きはheader、元設定のスナップショット参照、項目の変更集合、削除予定、文書blob参照を一つの整合した単位で保存する。削除予定も適用までは原本に反映しない。項目IDは表示名変更で変わらず、slug変更は明示的な参照更新を伴う。

`configurationRevision`は、エンジン版・ハーネス構成・プラグイン選択・関係する原本と投影先のhashから算出する。ファイル更新日時だけで同一と判定しない。下書きのrevisionとは別に扱う。以前のrevision値へ戻らないよう、適用・破棄後もdraft IDまたはrevisionを更新する。

既存の未知フィールドと本文は原文として保持する。AIや読み込みから来た未知の編集フィールドは拒否し、元から存在する値の保存と、新たにその値を設定する操作を区別する。

入力用`DraftInput`と検証済みの実行定義は別の型にする。既知の数値欄への空欄や`1.`などの入力途中の文字列も、上限付きのraw入力値と診断として保存できる。実行定義への変換は検証時に行い、変換不能な下書きをcastして生成へ渡さない。

型付きの`replace`は編集可能な既知field・本文範囲の変更を意味する。省略は維持、削除は明示的なunset操作とし、未知部分を含む原文参照はサーバーが保持する。原文全体の編集は別の`source/edit`契約とし、元ファイルhash・編集対象・変更後本文を照合して、全変更範囲を差分に示す。

## 7. 下書き保存と同時編集

詳細設計の既定として、変更後800msを目安に下書きを自動保存し、「下書きを保存」で即時保存できるようにする。これは正式適用ではない。保存中・保存済み・保存失敗を表示し、保存に失敗した入力を画面から消さない。ページ内の移動では状態を保持し、ウィンドウを閉じる際に未保存入力があれば通知する。

フォームの入力はブラウザー内で即時反映し、サーバーへは差分を一件ずつ送る。リクエスト送信後に追加入力された値を、先に送ったリクエストの応答で置き換えない。入力途中の不完全な設定も保存できるが、構造上受け付けられないデータや任意パスへの操作は保存しない。

サーバーは下書き専用のプロセス間lockの中でexpected revisionを照合し、一時ファイルの書き込みとrenameで保存する。IDE内のPromise列や一つのサービスインスタンスだけで排他しない。応答には新revisionとrequest IDを返し、再送記録を下書きと同じ更新単位へ含める。

同じ下書きへ別の画面から変更が入った場合、未保存入力がない画面は再取得する。未保存入力がある画面はその内容を保持して比較画面を出す。文章を自動合成しない。古いrevisionでの保存は409とし、無言で後勝ちにしない。

AI送信、提案・importの採用、検証、plan作成、書き出し、適用の前には、共通の保存待ち処理で未送信・送信中の編集queueを確定させる。保存失敗、結果不明、競合があれば後続操作を始めない。flush後に提案が古くなった場合も採用を停止する。これにより、自動保存前の800msに入力した値を古い提案が上書きすることを防ぐ。

意図的な破棄ではdebounceと未送信queueを止め、送信済み保存の結果を確定してから現在revisionを条件に破棄する。適用・破棄でdraft IDを更新した後は、旧IDの遅着保存を拒否する。画面の保存状態が確定するまで、同じ画面で次の確定操作を重ねない。

「直前の取り込みを取り消す」は、その取り込み後のrevisionが現在値と一致するときに限り、逆の変更を新revisionとして保存する。その後に別の編集が入っていれば、取り込み前の下書き全体を復元せず、現在との差分を確認して新たな編集として戻す。

外部で現行設定が変わった場合は、下書きを保持したまま基準設定の更新が必要と表示する。基準・現在の設定・下書きを比較し、変更対象外の設定は取り直せる。同じ項目への双方の変更は、利用者がどちらを残すか決める。更新後はAI提案と以前の適用確認を失効させる。

## 8. AI提案

既存Docs Q&Aから、CLI検出、固定引数、一時作業ディレクトリ、stdin入力、stream解析、キャンセル・timeoutを共通の`ai-cli`へ抽出する。Q&Aの検索・回答整形・引用必須判定はカスタマイズへ流用しない。

カスタマイズAIサービスへ下書きwriterや適用writerを渡さない。サーバーが取得した設定と資料のスナップショットだけを渡し、CLIへプロジェクトの実パスや編集ツールを渡さない。現在のCLI制限はOSのファイル書き込み禁止機構ではないため、対応CLI版ごとのフック・MCP・グローバル設定抑止の検証を受入条件とする。

### 8.1 入力と生成

送信前にフォームの変更を保存する。確定revisionから、選択項目、関連する変更、参照関係、適用層のルール、対応版の公式資料、利用者が選択した資料、上限付き会話履歴を取得する。資料にはID・hashを付け、指示文ではなく検討対象データとして扱う。

ワークフロー成果物を相談の参考にする場合も、利用者が既存資料一覧から明示的に選んだ読取対象に限る。コピーして実行する試行機能は作らない。アプリケーションコード全体や監査・認証ファイルを自動収集しない。長い資料は省略部分を示し、全部を読んだことにしない。

一つの下書きでは同時に一つのAI jobを実行する。jobにはプロセス間で共有するIDと所有プロセス情報を持たせる。再起動時は未完了jobの所有状態と子CLIを確認し、子CLIの停止を確認できたものを中断として復元する。同じrequest IDによる再送でAIを再起動しない。

job状態は`reserved → running → stopping → cancelled/completed/error/interrupted`とし、owner ID・世代token・プロセス生成時刻を保持する。別プロセスからのcancelは永続的な停止要求としてownerへ届ける。ownerは子CLIの終了を確認してから終了状態とする。状態・提案の公開は所有tokenが一致するときだけ許可する。

ownerが死亡しても、子CLIの停止を確認するまでは実行枠を空けない。PID再利用を区別できない等の理由で確認不能なら復旧待ちにする。spawn前後の停止でも同じrequestを自動的に再起動せず、古いownerからの遅着結果を公開しない。

### 8.2 出力と取り込み

最終出力は、schemaVersion、要約、変更一覧を持つJSONとする。各変更は項目ID、`create/replace/remove`、型付きの変更後データ、理由、資料IDを持つ。サーバーがproposal ID、生成元のdraft/configuration revision、context hashを付ける。

途中のstreamは生成状況として表示し、採用可能な変更にはしない。正常終了と完全なJSONの検証がそろった後、サーバーが変更前後を計算して公開する。モデルが返した「変更前の内容」を事実として表示しない。

取り込みAPIにはproposal IDを送り、変更本文をクライアントから再送しない。生成元と現在のrevisionが違う提案は`proposal-stale`として停止し、最新の下書きから再提案できるようにする。変更が別の項目であっても初版は下書き全体のrevisionで判定する。

提案の採用は一つの下書き変更として保存する。設定として未完成な案も下書きには取り込めるが、参照不足などの診断を表示する。採用済みであることと、正式適用できることを混同させない。

## 9. 配布と読み込み

### 9.1 Guide用設定ファイル

拡張子は`.aidlc-guide.json`、形式は`schemaVersion: 1`のJSONとする。package ID、名前、version、対象エンジンの互換条件、項目一覧、項目間の参照、含める資料、内容hashを持つ。資料バイナリはbase64と元のbyte数・hashを付ける。絶対パス、マシン固有の参照先、下書きrevision、会話、復旧journalは含めない。

初期上限案は、単一の原本10MiB、デコード後の配布内容50MiB、項目500件。HTTPとwebviewの双方で同じ上限を検査し、base64の増分も受信前のサイズ制限へ含める。上限超過時は選択内容を残して対象を減らせるようにする。

読み込みでは形式・hash・参照・サイズを検査し、原本へ書かずimport planを作る。項目は初期状態では未選択。同じ項目を置き換える場合は下書き側を残す表示を初期値にする。IDが一致しない同名項目は自動的に同一と決めず、追加・対応付け・取り込まないを確認する。

`rule-section`の配布payloadは、適用層、必要ならphase、見出し、本文、由来ID、基準章hashを含む。import planで配布先space・層・既存章との対応または新規章の挿入位置を確定し、ローカルIDを割り当てる。由来IDは移行履歴として保持する。ファイルmetadataは独立した選択項目であり、章の取り込みに伴って自動変更しない。別層の同名章を同一扱いしない。

選択した項目に不足する参照先がある場合は、追加選択する候補を表示する。必要だからと未選択項目を自動追加しない。不足を残した取り込みは未完成の下書きとして許可し、適用前に解消する。

取り込みは、import planとexpected revisionを照合して選択項目を一括更新する。確認中に下書きが変わった場合は再比較する。読み込み元のpathや命令をファイル操作として実行しない。

### 9.2 標準プラグイン

標準形式の`.aidlc-plugin/plugin.json`と所定のサブディレクトリから、選択したハーネス向けの出力を生成する。書き出しは原本と生成済み配布物を含むZIPとし、元パッケージの保管が必要なネイティブ更新処理にも対応する。

| 選択内容 | 2.8.2での標準書き出し |
| --- | --- |
| 新規工程・scope・エージェント・センサー・方法論資料・tools | 対応。所有名と参照の整合が必要 |
| 既存工程への成果物・入力・センサー・scope・本文断片の追加 | 対応する追加操作だけを出力 |
| memoryルール・成果物テンプレート・spaceのチーム資料・DocumentKB | 標準形式への同梱対象外。Guide形式を使う |
| 既存工程の担当者・依存関係・レビュー等の置換、既存項目の削除 | 標準形式では表現できない。Guide形式を使う |

含められない項目と、それに依存して配布不能になる項目を一覧にし、対象から外した結果を利用者が確認してから書き出す。省略しても同じ動作になるとは表示しない。プラグイン名の接頭辞が必要な識別子は対応表を示して参照も変換する。動的なコマンド文字列内など、安全に機械変換できない参照は手動修正を求める。

バージョン・依存関係はGuide側でも静的に検査する。ただし2.8.2の利用先が依存バージョンを強制するとは表示しない。既存の`plugin-test`、ユーザーのcompose hook、センサーコマンドは書き出し処理で実行しない。エンジンの信頼されたデータ変換器と既定テンプレートだけを使う。

未適用の下書きからも、検証済みの選択内容を書き出せる。書き出し完了をプロジェクトへの適用完了として扱わず、下書きも自動的に消さない。

## 10. 検証と適用計画

検証は四段階に分け、設定を保存できるかと正式適用できるかを分ける。

| 段階 | 検査 | 失敗時 |
| --- | --- | --- |
| API受付 | データ型、項目種別、操作、ID、サイズ、許可された参照先 | リクエストを拒否し、入力を画面に残す |
| 下書き診断 | 必須値、名前重複、参照先、工程依存の循環、レビュー対象、scope・sensorの整合 | 下書きは保持し、該当項目から修正できる |
| 生成・配布 | 対応版の実装可能範囲、標準形式の制約、名前空間、生成物の整合 | 適用・該当形式の書き出しを停止 |
| 正式適用直前 | revision、原本と出力のhash、全ハーネス、未完了record・実行中操作、復旧待ち | 適用を停止し、理由と対象を表示 |

自然文のルールに従う成果物が生成されることや、commandの実行成功は静的検証の対象外。`when`、`required_sections`、ルールのstatus等は、schemaに存在するだけで機能しているとは判断しない。

適用計画は、検証した下書き、設定revision、エンジン能力、生成器の版、全出力の変更前後hash、変更ファイル、必要な削除、確認すべき診断から作る。plan IDをサーバーで保持し、利用者へその差分を提示する。クライアントから送られた任意のファイル一覧をそのまま適用しない。

計画の生成は現在設定を変更せず、ステージやプラグインの任意コードを実行しない。一時領域は変換結果と復旧用ファイルの保管に使い、試行ワークフローとして公開しない。

## 11. 正式適用と復旧

### 11.1 開始条件

次がすべて成立した場合だけ「適用」を受け付ける。

- ローカル編集可能モードで、IDEではWorkspace Trustを満たす。
- 下書きと現行設定が確認したplanのrevision・hashと一致する。
- 対象ルートの全ハーネスと設定更新ツールが第12節の連携に対応する。
- 同じ設定を共有する全spaceに未完了recordがなく、初期化・単独工程・compose等の進行中操作もない。
- 復旧待ちのtransactionがなく、原本と生成物の構成が検証できる。

`active-intent`やGuideで表示中のworkflowだけで判定しない。各spaceのregistryと実recordの和集合を調べる。Running、承認待ち、一時停止、修正中、未完了のArchivedは終了扱いにしない。終了判定は対応版のregistryとstateの両方が整合するときに限る。欠落・読取失敗・矛盾・不明な状態は「未完了なし」と推測しない。

### 11.2 処理順序

1. planから全原本・生成物・削除予定の候補と変更前コピーを用意し、transaction journalを保存する。この段階では現行ファイルを書かない。
2. エンジンと同じcanonical workspace lockを取得する。次に下書きlockを取得する。逆の順序で両方を保持しない。
3. revision、実ファイルhash、未完了record、進行中操作、能力情報を再確認する。変化があればファイルを書かず終了する。
4. 候補・バックアップ・完全なjournalの永続化を完了してから、transaction IDを持つpending markerを永続化する。この順序を逆転しない。
5. すべての対象ハーネス、原本、登録情報へ変更を反映する。各ファイルは同じボリューム上の一時ファイルから置換し、作成・置換・削除をjournalに記録する。
6. 対象ファイルの置換・削除と必要なディレクトリの同期を完了し、全変更後hashと削除対象を検査する。成功と新しい設定revisionを含む一つのcommit記録を原子的に永続化する。
7. 下書きの基準を新設定へ更新し、適用済み変更を解消する。取り込み・確認済み提案の旧revisionを失効させ、再送に返す確定結果を永続化する。
8. pending markerを解除してlockを返し、成功とtransaction IDを返す。UIは新設定を再取得する。

適用計画には既存ファイルが存在しない場合も`beforeHash: null`として含める。削除はGuideが所有する追加項目や明示された変更範囲に限定し、ディレクトリ全体を置換しない。原本以外の利用者のファイル・未編集章は保持する。

複数ファイルを物理的に同時置換するわけではない。協調する設定読込側をpending markerで止めることにより、論理的に一括適用する。通常例外時のrollbackだけで、強制終了にも対応できるとは説明しない。

### 11.3 journalと復旧判定

journalはtransaction ID、plan ID、旧・新設定revision、適用対象のdraft ID・revisionと整理後のdraft ID・revision、対象ルート・ハーネス、全変更パス、変更前後hash、バックアップ参照、段階、commit結果を保持する。request IDとtransaction IDを対応付け、応答を失った再送でも同じ操作結果を取得できるようにする。

| 検出状態 | 復旧動作 |
| --- | --- |
| 候補生成中に停止し、pendingなし | 現行設定は未変更。孤立候補を回収し、下書きを維持 |
| pendingあり、commitなし | 同じworkspace lock下で変更前へ復元。各ファイルはbefore/afterのどちらかに一致することを確認 |
| pendingあり、commitあり | 全変更後hashを確認し、下書き整理など未完了の後処理を完遂 |
| 現在のhashがbefore/afterのどちらでもない | 外部変更として停止。バックアップとmarkerを保持し、対象ファイルを表示 |
| 復旧中に再び停止 | 同じjournalで再開。既に復元済みのファイルはbeforeHashで識別 |

復旧もworkspace lock、下書きlockの順で取得する。commit後の下書き整理は、現在のdraftが適用対象ID・revisionと一致するときだけ行い、整理済みなら何もしない。停止後に新しい編集が保存されていれば、その内容を保持して基準更新待ちにする。古い下書き全体で上書きしない。

復旧はファイルごとの完了フラグだけに依存せず、journal内の全対象をbefore/after hashで判定する。rename直後・記録更新前の停止も扱う。commitとrevisionの正本は同一記録とし、`current.json`はそれを指す再構成可能な参照にする。同期・置換の契約を満たせないファイルシステムや外部配置では、保証できるものとして適用しない。

空き容量不足、権限エラー、Windowsでファイルが使用中、監視プロセスの介入も成功扱いにしない。復旧が完了するまで新規開始・再開・設定更新を止める。復旧は不完全な操作を戻す処理であり、保留していた下書きを自動適用する機能ではない。

通常の適用後に設定を戻したい場合は、変更前の項目を新しい下書きへ取り込み、同じ確認・手動適用を行う。一つ前の設定へ直接戻す別の書き込み経路は設けない。

## 12. 必須のエンジン連携

以下は提案する共通契約であり、2.8.2に存在するAPI名・機能ではない。Guide内のボタン制御だけで代替しない。

### 12.1 設定の読込前に行う受付

エンジンの新規開始、resume、next、continue、単独工程、compose、設定を読む関連hookは、最初の読込前に共通受付を通す。同じworkspace lockの中でpending marker、設定revision、原本と投影先の整合を確認し、設定キャッシュを読み直す。lock取得前のキャッシュを再利用しない。

Guide自身のcatalog、基準更新、plan、配布、AI contextの読取も共通coordinatorを通す。workspace lock下でpendingとrevisionを確認し、必要な原本・生成物を一つのスナップショットとして取得してからlockを返す。以後の処理はそのスナップショットを使う。pending中は一貫した確定済みスナップショットを返すか復旧待ちとして停止し、部分更新された実ファイルを寄せ集めて返さない。

下書きのスナップショットには期待revisionを指定し、両方のlockが必要なときはworkspace→下書きの順を使う。snapshotとdraftの基準revisionが違えば再比較へ戻し、不整合な組み合わせで生成しない。

受付で使う設定revisionは、その後の処理にも結び付ける。新しいworkflowには作成時のrevisionを記録する。適用時に過去のworkflow状態を書き換えない。完了済みの古いworkflowを再開する場合もrevision差異を検出し、旧設定の復元など明示的な手順なしに新設定で再開しない。

### 12.2 record外の操作の保護

初期化前、composeの提案・承認待ち、単独工程などには、設定読込前からoperation leaseを永続化する。leaseはsession ID、operation ID、設定revision、状態を持ち、通常workflowが作成された場合はそのrecordへ引き継ぐ。

CLIの終了を作業終了と判定しない。LLMが受け取った工程を続けるため、leaseの終了はエンジンの最終reportまたは明示的な操作終了で記録する。一時停止や承認待ちでは残す。時刻だけで自動的に有効期限切れとせず、孤立した操作は実行停止を確認できるエンジンの修復手順で解消する。

lease確認とpending marker作成を同じlock内で行うことで、その間に新しい操作が入り込むことを防ぐ。

### 12.3 生成・更新の共通契約

エンジン側に、プロジェクト所有の変更定義を入力にするデータのみの検証・生成契約を追加する。契約は、対応能力の取得、原本の読込、変更の検証、ハーネス別の候補生成、設定revisionの発行、適用受付・復旧を扱う。工程実行は行わない。

候補生成は、基準となる正規定義、選択中の標準プラグイン、Guide用の既存定義変更を順に解決する。未知の生成済みインストールだけから正規原本を推測しない。既存pluginのcompose hookを無条件で実行するAPIにせず、検証した宣言データとエンジンの既定変換器を使う。

DocumentKBも外側transactionへの参加契約を設ける。原本の抽出と登録候補生成は準備段階で行い、登録IDの対応・metadata・indexは原本と同じ適用計画へ含める。workspace lockを保持したまま、独自に同じlockを取得する既存CLIを呼び出さない。登録部分を既存機能から分離し、外側coordinatorが一度だけlockとcommitを所有する。

抽出器不足や文書の抽出失敗は、既存の`extractor_unavailable/extraction_failed/unsupported_type`等を持つ登録候補として扱う。原本と登録を整合した状態で適用できるが、「本文を参照できる」とは表示しない。AIへ未抽出本文を渡さず、後のDocumentKB同期で再処理する。catalogそのものの書込み失敗はtransaction全体を復旧する。抽出準備は承認対象文書に対する既存の制限付き抽出器だけを使い、ワークフローやセンサーを実行する試行とは分ける。

通常のnative setup・更新・plugin同期も同じ受付とpending検査を使う。Guideの変更が存在する場合、更新は基準版・上流新版・利用者変更を照合する。異なるフィールドの変更は機械的に整合させられるが、同じフィールド・本文への双方の変更は確認を必要とする。生成済みハーネスを更新して利用者変更を消す動作をしない。

### 12.4 能力確認と導入条件

バージョン番号の比較だけでなく、必要な契約の対応と、全インストール先の生成物が一致することを確認する。旧ハーネス、別の旧CLI経路、外部共有設定が残る場合、対応が確認できるまで正式適用を許可しない。対応済みCLIだけを案内することも導入条件に含める。

通常の設定配置から外れた直接編集や、制御を迂回する旧バイナリをOSレベルで禁止する設計ではない。保証対象は、この契約を共有する導入済みエンジン・Guide・更新処理である。検出できる不整合は停止し、検出できない任意の外部書き込みまで防止できるとは説明しない。

2.8.2のままでも下書きの編集や配布ファイルの作成は設計可能だが、これを全機能実装済みの初回リリースと扱わない。確認済みの正式適用機能を提供するには、本節のエンジン連携がリリース前提になる。

## 13. サービス・API・権限境界

### 13.1 モジュール構成

| モジュール案 | 責務 |
| --- | --- |
| `shared-types/src/customization.ts` | 項目、下書き、診断、提案、plan、job、エラーのwire型 |
| `api-core/src/ai-cli/` | Q&Aと共有する制限付きCLI実行。設定writerは持たない |
| `api-core/src/customization/catalog.ts` | 原本と投影結果を読み、編集可能性・参照関係を返す |
| `api-core/src/customization/draft-store.ts` | 唯一の下書き、revision、原子的保存、再送判定 |
| `api-core/src/customization/proposals.ts` | 検証済みAI提案と読み込みplanの採用 |
| `api-core/src/customization-ai/` | context、生成job、構造化出力検証。正式適用への依存なし |
| `api-core/src/customization/engine-adapter.ts` | エンジンの対応能力、純粋な検証・生成、適用受付との接続 |
| `api-core/src/customization/apply.ts` | 利用者が確認したplanを照合し、エンジンの適用・復旧サービスを呼ぶ。適用アルゴリズムを複製しない |
| `api-core/src/customization/packages.ts` | 選択内容の読み込み・書き出し、形式・参照の検査 |
| `dashboard/src/components/customization/` | ページ、一覧、フォーム、AIチャット、差分、取り込み画面 |

`createGuideService()`にサービスを組み込み、HTTPとwebviewを既存の共通POSTルート表へ登録する。VS Code依存のファイル操作をdashboardへ持ち込まず、ブラウザーにも同じ操作を提供する。既存nativeのlock・ファイル更新処理を参考にエンジン側へ共通の適用・journal契約を実装し、Guideの共有Node層と既存setup/updaterはその呼出し側にそろえる。

### 13.2 API

以下は追加するルート案。GETは読取のみ。状態を作る処理はPOSTにする。

| API | 主な入力・出力 |
| --- | --- |
| `GET /api/customization` | 能力、対象space、現設定revision、項目概要、適用を妨げる状態 |
| `GET /api/customization/item?id=…` | 型付き項目、原文、参照先・参照元、保存先の説明 |
| `GET /api/customization/draft` | 下書きとrevision。無ければ未作成を返す |
| `POST /api/customization/draft/open` | request ID、space、設定revision。唯一の下書きを作成または再取得 |
| `POST /api/customization/draft/save` | request ID、expected revision、型付き変更。新revisionを返す |
| `POST /api/customization/source/edit` | 原文編集。項目ID、元hash、変更後本文、expected revision |
| `POST /api/customization/draft/discard` | expected revision。破棄対象を確認した操作として処理 |
| `POST /api/customization/draft/reconcile` | 外部変更との比較結果、利用者の選択。新しい基準を確定 |
| `GET /api/customization/ai/tools` | CLI利用可能性。共有閲覧時にはprobeしない |
| `POST /api/customization/ai/ask` | message、tool、draft revision、選択資料ID。job IDを返す |
| `GET /api/customization/ai/job?id=…` | 生成状況、最終提案、生成元revision |
| `POST /api/customization/ai/cancel` | job ID。停止済みなら同じ結果を返す |
| `POST /api/customization/proposal/adopt` | proposal ID、MutationHeader。本文の再送はしない |
| `POST /api/customization/proposal/undo` | 採用操作ID、expected revision |
| `POST /api/customization/import/analyze` | 配布データ。比較用import plan IDを返す |
| `POST /api/customization/import/adopt` | plan ID、選択項目、expected revision |
| `POST /api/customization/validate` | draft revision。診断一覧を返す |
| `POST /api/customization/plan` | draft revision。確認用plan・差分を返す |
| `POST /api/customization/apply` | request ID、plan ID、draft/configuration revision。transaction IDを返す |
| `GET /api/customization/operation?id=…` | 適用・復旧・書き出しの状況と確定結果 |
| `GET /api/customization/request?id=…` | request IDから受付状態とjob/transaction ID・結果を取得 |
| `POST /api/customization/export` | 形式、選択項目、revision、非対応項目の除外確認。出力IDを返す |
| `POST /api/customization/assets/stage` | 選択した原本の名前・型・byte数・内容・hash。blob IDを返す |
| `GET /api/customization/export/output?id=…` | サーバー発行の出力IDから配布ファイルを取得 |

文書・配布物の転送はサイズ制限付きの共通サービスへ渡し、ブラウザーでは選択したファイルを読み、出力をダウンロードする。IDEでは同じデータ契約をホストのファイル選択・保存へ接続する。任意パスをPOSTしてサーバーに読ませる形式にしない。

変更系にはrequest IDによる再送判定を実装する。入力が異なる同一IDは拒否する。POSTの応答待ちにはtimeoutを設けるが、timeoutを処理失敗と決めつけずoperation IDで照会する。重いAI・適用・書き出しは受付後にjob/transactionを返し、HTTPとwebviewの双方で状態を取得できるようにする。

受付応答自体を失った場合はrequest IDから照会する。workspace共通の永続受付記録へ、request ID、操作種別、正規化した入力hash、受付状態、job/transaction ID、確定結果を保存する。同じIDの再送はrevision検査より先に照会し、既に成功した操作を古いrevisionエラーや新規実行にしない。下書きの適用・破棄で受付記録を消さない。

初期保持期間は確定結果7日とし、request IDには発行時刻とランダムIDを含める。期限を過ぎたIDや記録の欠損した受付済みIDは再実行せず、結果不明として現状態との照合を要求する。実行中・復旧待ちの記録は期限では消さない。処理開始前に受付を永続化し、変更commitと結果記録の対応をjournalで復元できるようにする。

下書き変更・設定変更・operation終了は既存hubへ通知を追加する。通知はrevisionとIDを中心とし、本文は必要時に取得する。別プロセスの変更も監視し、画面を再接続した場合は必ず再取得する。AI jobのpollingは既存Q&Aと同じ仕組みを再利用する。

### 13.3 受付とファイル操作

共有hostモードでは、現行設定の読取りだけを許可する。下書き・会話の取得、AIの起動・キャンセル、保存、取り込み、書き出し生成、適用はサービス入口で拒否する。読み取り専用は利用者ロールではなく起動モードの制約とする。

HTTPはloopback、Origin、JSON content-type、サイズを検査する。正式な書き込みでは同一Originを基本とし、開発proxyだけ明示的に許可する。IDEではWorkspace Trustも共通の受付条件に加える。

サーバーが項目IDから保存先を決める。path traversal、絶対パス、リンクによる対象外への書き込みを拒否し、存在しないファイルでは親ディレクトリまで検査する。既存readBoundedは表示用のBOM除去等を行うため、保存前後のhashと復旧コピーには加工前のbyte列を別途使う。

現在のBiomeのAPI書き込み制限は全面解除せず、下書き・適用・一時領域のwriterだけを列挙する。AIの出力をシェルへ連結せず、ツール起動引数は実装側で固定する。

### 13.4 主なエラー

| reason | 表示・操作 |
| --- | --- |
| `draft-conflict` | 自分の入力を残し、別画面の下書きと比較 |
| `proposal-stale` / `import-stale` | 内容を残し、最新revisionで再提案・再比較 |
| `configuration-changed` | 基準更新の比較へ戻る |
| `validation-failed` | 該当するカテゴリ・項目・fieldへ移動 |
| `workflow-active` / `operation-active` | 対象の未完了作業を表示。下書き保存は継続 |
| `workflow-state-unknown` | 不整合のrecordを表示。確認不能のまま適用しない |
| `engine-capability-missing` | 必要なエンジン連携と不足する導入先を表示 |
| `external-settings-root` | 外部設定の場所と対応範囲を表示 |
| `recovery-required` | transactionと対象ファイルを表示し、新規適用を止める |
| `read-only-mode` / `workspace-untrusted` | 編集機能を無効化。下書きを破棄しない |

## 14. エンジン連携の実装方針比較

| 案 | 利点 | 負担・制約 |
| --- | --- | --- |
| A. 受付・復旧契約とカスタマイズ入力をエンジン側へ追加する。採用 | Guide、CLI、全ハーネス、更新処理が同じ定義と適用規則を使える。Guide側の版別生成処理を減らせる | aidlc-workflows側の実装と対応版への更新が必要 |
| B. 受付・復旧契約だけをエンジンへ追加し、生成・更新アダプターをGuideが持つ | カスタマイズの生成機能をGuide側で開発しやすい | エンジンの版ごとに正規定義・生成物との互換性をGuideが維持する。競合保護のためのエンジン更新は依然として必要 |

2026-09-15、利用者がAを選択した。以下を実装の責務境界とする。

| 担当 | 実装する機能 |
| --- | --- |
| aidlc-workflows | カスタマイズ原本の検証、全ハーネスへの候補生成、設定revision、開始・再開との排他、適用・復旧、DocumentKBのtransaction参加、上流更新時の変更保持 |
| aidlc-guideの共通サービス | 一つの下書きと会話の保存、AI提案、項目選択による読み込み・配布、差分の提示、利用者の適用要求をエンジンへ渡す処理 |
| IDE・ローカルブラウザーの画面 | 六カテゴリのフォーム、編集／AIタブ、提案の確認・取り込み、差分確認・手動適用、処理状態とエラーの表示 |

エンジンの共通機能はGuideの画面やAIサービスへ依存させず、CLIと更新処理からも同じ契約で利用できるようにする。Guide形式の読み込みは共通の編集モデルへ変換し、標準プラグインの生成はエンジンへ委譲する。Guide独自の生成器・正式適用経路は併設しない。

対応版のエンジン開発と、Guideへの導入・互換性確認までを実装範囲に含める。対象バージョン番号や公開APIの名称は、エンジン側の変更を実装して互換性を確認した時点で確定する。

## 15. 実装単位と完了条件

これは実装順序であり、初回の機能範囲を段階リリースへ縮小する決定ではない。

1. エンジン能力・原本形式・受付・復旧・生成契約を確定し、固定版のfixtureを用意する。
2. 共有型、catalog、下書き保存、revision、識別情報、ファイル境界を実装する。
3. 六カテゴリの一覧・フォームとレスポンシブ表示を実装する。
4. 静的検証、Guide用変更定義、標準プラグイン生成、差分planを実装する。
5. エンジンとの協調適用、全ハーネス反映、復旧、setup/updater連携を実装する。
6. Q&AのCLI実行部を共通化し、AI提案・採用・取消しを接続する。
7. 選択読み込み、両形式の書き出し、IDE・ブラウザー双方の操作を仕上げる。

| 検証対象 | 必須の受入条件 |
| --- | --- |
| 原文保持 | 一つの章・fieldを変えても、他章、未知キー、改行、BOMを壊さない |
| 参照 | scope編集が工程所属へ、担当編集が工程側へ反映され、削除・rename後も整合する |
| 下書き | IDEとブラウザーから同時保存しても入力が無言で失われない。再起動で保存済み内容が戻る |
| AI | 未採用なら下書きbyte不変。古い提案、壊れたJSON、tool呼出し、キャンセル後の遅着を採用しない |
| 読み込み | 選んだ項目だけ更新する。依存先を無断追加せず、同名別IDを誤って上書きしない |
| 配布 | Guide形式で章単位の変更を移せる。標準形式の非対応項目を明示し、対応する全ハーネス出力が生成できる |
| 進行中の保護 | 非表示space、未完了Archived、単独工程、初期化前、compose待ちを含めて適用が止まる |
| 開始との競合 | 開始/resumeと適用を同時に起動し、旧・新設定が混在しない。lock前の古いcacheを使わない |
| 復旧 | journal各段階で強制終了させ、旧設定への復元またはcommit後処理を再開できる |
| 二重実行 | 応答喪失、二重クリック、同じrequest IDの再送で適用・AI起動が増えない |
| 上流更新 | 変更を保持して再生成できる。同じ項目の競合時は設定を消さず停止する |
| 表示 | 320pxのタブ操作、広い画面との切替、未送信文・会話・スクロール保持、キーボード操作 |
| 利用環境 | ローカルブラウザーとwebviewで同じAPI動作。共有hostと未信頼workspaceからの迂回要求も拒否 |
| 試行機能の非導入 | 検証・配布・適用でステージ、テスト、sensor command、任意plugin hookを起動しない |

実装時には関連テストに加え、リポジトリの`bun run check`を通す。エンジン対応版を変更する場合は既存のupgrade checklistに従う。本作業は設計文書のみのため、アプリ全体のテストを実装済みの検証として実行・報告しない。

## 16. 調査根拠

以下は現状の根拠。本書の新規パス・型・API・連携契約は既存実装と区別する。

| 根拠 | 確認した内容 |
| --- | --- |
| `packages/dashboard/src/components/Header.tsx:29`、`store/state.ts:58`、`store/reducer.ts:18` | 既存の最上位ナビゲーションと画面状態 |
| `packages/api-core/src/service.ts:45`、`handlers/post.ts:37`、`packages/dashboard-server/src/server.ts:51` | IDE・HTTPから共有できるサービスとPOSTルート |
| `packages/dashboard/src/services/transport/types.ts:51` | HTTPとwebviewの共通JSON transport |
| `packages/api-core/src/docs-qa/process.ts:22`、`:202`、`scratch.ts:7`、`copilot.ts:8` | CLIの制限、stdin入力、一時cwd、tool検出、停止 |
| `packages/api-core/src/docs-qa/index.ts:49`、`:147` | 現行jobはメモリ上の管理。プロセス間の下書き共有機構ではない |
| `packages/vscode-extension/src/guide-session.ts:109`、`:122` | Workspace Trustと共有ルートへの接続 |
| `packages/vscode-extension/src/native-workspace-lock.ts:177` | 上流と共通のworkspace lock |
| `packages/vscode-extension/src/native-harness-install.ts:62` | 現行の未完了検査。欠損やregistry/state不一致に追加対応が必要 |
| `packages/vscode-extension/src/native-harness-merge.ts:608` | 現行のharness単位の例外rollback。永続journalは未実装 |
| `packages/vscode-extension/src/native-plugin-inputs.ts:149` | 原本パッケージと対象ハーネス向け出力が更新時に必要 |
| `packages/core-utils/src/read-bounded.ts:13`、`:35` | 読取サイズとBOM処理。byte保存用途との区別 |
| `biome.json:185`、`:255` | APIからのファイル書き込み境界 |
| [ルール仕様](../../reference/en/08-rule-system.md) | 既定memoryファイル、章、層、status・pairingの意味 |
| [プラグイン仕様](../../harness-engineering/en/10-authoring-a-plugin.md) | 追加形式、非対応フィールド、名前空間、依存解決の制約 |
| [scope](../../harness-engineering/en/04-scopes.md)、[agent](../../harness-engineering/en/03-adding-an-agent.md)、[sensor](../../harness-engineering/en/06-sensors.md) | 編集する原本と、工程側に保存する参照関係 |
| [チーム資料](../../harness-engineering/en/07-team-knowledge.md)、[DocumentKB](../../reference/en/10-knowledge-system.md) | チーム資料・原本・派生カタログの所有境界 |
| `.claude/tools/aidlc-stage-schema.ts:13`、`aidlc-sensor-schema.ts:31` | 現導入版の型と、実際にパースするfield |

upstream checkoutで追加確認した箇所は、2.8.2の`core/tools/aidlc-utility.ts:5860,5963`、`aidlc-lib.ts:22056,26200,26276`、`aidlc-orchestrate.ts:3923,7019,8073`、`aidlc-steering.ts:55,85`、`aidlc-transaction.ts:403,481`、`scripts/plugin-hooks-template/compose.ts:2194`。それぞれ、lock前のscope読込、workspace lock、設定cache、ルール本文読込、単独工程、外部ルール参照、メモリ内transaction、追加形式の拒否を確認した。
