# 技術環境文書の書き方

技術環境文書は、**プロジェクトをどう作るか** を述べるものです。使わなければならない言語、フレームワーク、クラウドサービス、セキュリティの規則、テストと、使ってはいけないものです。[ビジョン文書](vision-document-guide.md) の技術面の対になる文書で、Construction のステージが作業の拠り所にする参照先です。

これがないと、設計と構築のステージは、選択のたびにあなたに尋ねるか、後で変えなければならない既定を選びます。許可の一覧と禁止の一覧を、それぞれ理由付きで書いておけば、エージェントが推測しなくなります。

---

## AI-DLC での置き場所

ビジョン文書は最初の依頼に入れます。技術環境文書は、すべてのステージが読む場所、つまりスペースのチームナレッジに置きます。

1. `aidlc/spaces/<space>/knowledge/aidlc-shared/technical-environment.md` として保存します（ほかのスペースを作っていなければ、スペース名は `default` です）。`aidlc-shared/` の Markdown ファイルは、すべてのステージの文脈に入ります。[ナレッジ](../08-knowledge.md) の章では、このフォルダを `aidlc/knowledge/aidlc-shared/` と呼んでいます。
2. すべてを `aidlc-shared/` に置いてください。セキュリティ、テスト、クラウドの標準は、別々のエージェントが主導するステージが読みます（たとえば Code Generation は developer エージェントとして動きます）。エージェント自身のフォルダは、そのエージェントが動いている間しか読まれません。エージェントのフォルダは、一つのエージェントだけが必要とする資料にだけ使ってください。フォルダ名は [社内標準の追加](../08-knowledge.md#社内標準の追加) を見てください。
3. 決して破ってはいけない少数の規則（禁止するライブラリ、必須のバージョン）は、`aidlc/spaces/<space>/memory/project.md` にも書いてください。チームが手がけるすべてのプロジェクトに当てはまるなら `team.md` に書きます。メモリファイルは、すべてのステージが適用する規則です。[ルールと学習ループ](../09-rules-and-the-learning-loop.md) を参照してください。

これは、その作業の最初の `/aidlc` の前に行ってください。計画に Practices Discovery が含まれる場合、Inception の早い段階で、チームの仕事の進め方を尋ねてきます。新しいプロジェクトでは、この文書にすでにある答えはすぐに確認できます。

---

## 短い版

```text
1. Language and version
2. Package manager
3. Web framework (if any)
4. Cloud provider and deployment model, or "local only"
5. Test framework
6. Prohibited libraries and services, as a table: prohibited | reason | use instead
7. Security basics: how users sign in, how input is validated, where secrets live
8. Example code: one short example each of a typical endpoint, function and test
```

項目 6 では、理由と代替が大事です。それがないと、エージェントは禁止には従いますが、よい代わりを判断できません。

項目 8 では、短い例が 1 つか 2 つあるだけでも、Code Generation は型を発明する代わりに従うべき型を得られます。基本を超えて足すものの中で、いちばん役に立ちます。

### 既存のコードベースでの作業の場合

```text
1. Existing stack: language, framework, database, infrastructure, with versions
2. What never changes: services, schemas, contracts, configuration no piece of work may touch
3. Prohibited patterns: libraries or approaches that conflict with the existing code
4. Security basics: how sign-in and secrets work in the existing system
5. Example code taken from the existing codebase
```

例は実際のファイルから取ってください。そうすれば新しいコードが既存のコードになじみます。Reverse Engineering もコードを読みますが、どの型を残したく、どの型から離れようとしているのかは分かりません。

この作業が足したり変えたりするもの、およびこの作業だけが触れてはいけないものは、[ビジョンのメモ](vision-document-guide.md#既存のコードベースでの作業の場合) に書きます。この文書はスペースに残り、後のすべての作業がそれを読むからです。

プロジェクトが新規か既存かは、この文書ではなく、プロジェクトフォルダのコードから判断されます。既存のプロジェクトを AI-DLC が新規と呼んだときは、依頼でそう伝えるか、`/aidlc --project-type brownfield` で始めてください。

---

## 完全な構成

各セクションに、対象のプロジェクトの種類を印として付けています。**（新規）** は新しいプロジェクト、**（既存）** は既存のコードベースでの作業、**（共通）** は両方です。

### 1. プロジェクトの技術概要（Project Technical Summary）（共通）

```markdown
## Project Technical Summary

- **Project name**: [Name]
- **Project type**: [New / Existing codebase]
- **Runtime environment**: [Cloud / On-premises / Hybrid]
- **Cloud provider**: [AWS / Azure / GCP / Multi-cloud / None]
- **Deployment model**: [Serverless / Containers / VMs / Hybrid]
- **Team size and key skills**: [Number, experience relevant to the choices]
```

### 2. プログラミング言語（Programming Languages）（共通）

```markdown
## Programming Languages

### Required
| Language | Version | Purpose | Reason |
|----------|---------|---------|--------|
| TypeScript | 5.x | Backend services, infrastructure code | Team expertise, type safety |

### Permitted with justification
| Language | When it may be used |
|----------|---------------------|
| Go | High-throughput services where latency is critical |

### Prohibited
| Language | Reason |
|----------|--------|
| PHP | No team expertise, not the platform direction |
```

既存のコードベースでは、すでに使っている言語と、それぞれの方針（維持、アップグレード、移行）を足してください。

### 3. フレームワークとライブラリ（Frameworks and Libraries）（共通）

```markdown
## Frameworks and Libraries

### Required
| Framework or library | Version | Area | Reason |
|----------------------|---------|------|--------|
| React | 18.x | Frontend UI | Organisational standard |
| Jest | 29.x | Unit tests | One test runner across projects |

### Preferred when the need arises
| Library | Purpose | Use when |
|---------|---------|----------|
| Zod | Runtime validation | Any external input or API payload |
| Pino | Structured logging | Every service that logs |

### Prohibited
| Library | Reason | Use instead |
|---------|--------|-------------|
| Moment.js | Deprecated, large | date-fns or Luxon |
| request | Deprecated | Native fetch |

### Getting a new library approved
[Who approves a library that is not listed, and what they need to see.]
```

### 4. クラウド環境とサービス（Cloud Environment and Services）（共通）

```markdown
## Cloud Environment

- **Provider**: [AWS / Azure / GCP]
- **Account structure**: [Single account / Multi-account]
- **Regions**: [Primary, and disaster recovery if any]

### Allowed services
| Service | Approved use | Constraints |
|---------|--------------|-------------|
| AWS Lambda | Event-driven compute, API handlers | 15 min timeout |
| Amazon DynamoDB | Key-value and document storage | On-demand for dev |
| Amazon S3 | Objects, static assets | Versioning and encryption on |

### Disallowed services
| Service | Reason | Use instead |
|---------|--------|-------------|
| Amazon EC2 (direct) | Prefer managed compute | Lambda or ECS Fargate |

### Getting a new service approved
[Who approves a service that is not listed, and what they need to see.]
```

### 5. アーキテクチャとパターン（Architecture and Patterns）（共通）

```markdown
## Architecture and Patterns

| Pattern | When to use | When not to use |
|---------|-------------|-----------------|
| Serverless-first | Default for new services | Long-running or connection-heavy work |
| Modular monolith | Single-team projects, first releases | Independently scaled domains |

### API standards
- **Style**: [REST / GraphQL / gRPC]
- **Versioning**: [URL path / header]
- **Documentation**: [OpenAPI 3.x for every REST API]
- **Naming**: [kebab-case URLs, camelCase JSON fields]
- **Errors**: [The standard error response shape]

### Data
- **Primary store**: [e.g. DynamoDB for service-owned data]
- **Relational data**: [e.g. PostgreSQL when queries need joins]
- **Ownership**: [e.g. each service owns its data; no shared databases]

### Messaging
- **Synchronous**: [e.g. HTTP between services]
- **Asynchronous**: [e.g. a queue for tasks, an event bus for events]

### Frontend (if any)
- **Components, state, routing, build tool**: [Your choices]
```

### 6. セキュリティ（Security）（共通）

```markdown
## Security

### Sign-in and access
- **Authentication**: [e.g. Amazon Cognito, OIDC, SAML]
- **Authorisation model**: [e.g. role-based]
- **Tokens and sessions**: [Format, expiry, refresh]

### Data protection
- **At rest**: [Encryption required, key management]
- **In transit**: [TLS 1.2 or later]
- **Personal data**: [Fields, masking, retention]

### Secrets
- **Storage**: [e.g. AWS Secrets Manager]
- **Rotation**: [Every N days]
- **Never**: secrets in source code, in config files, or shared between services

### Compliance
- **Standards**: [SOC 2, HIPAA, PCI-DSS, GDPR, or "none specific"]
- **Audit logging**: [What is logged, and for how long]
- **Scanning**: [Dependency and image scanning tools]
- **Licences**: [Allowed: MIT, Apache 2.0, BSD. Prohibited: GPL, AGPL]
```

#### セキュリティフレームワークを選ぶ

フレームワークを一つ選び、その各カテゴリにプロジェクトがどう対処するかを書いてください。当てはまらないカテゴリにはその理由を書き、後で入れる予定の対策には、その穴と時期（フェーズ）を書きます。

| プロジェクトの種類 | よくある選択 |
|-----------------|----------------|
| Web アプリケーションと API | OWASP Top 10、OWASP API Security Top 10 |
| クラウドインフラ | クラウドプロバイダーの Well-Architected のセキュリティの柱、CIS Benchmarks |
| 政府系または規制対象 | NIST 800-53、FedRAMP、ISO 27001 |
| 一般的なソフトウェア | CIS Controls v8、SANS Top 25 |

カテゴリが 10 個以下のフレームワークなら、完全な表をこの文書に入れてください。大きなフレームワークなら、この文書の隣の専用ファイル（たとえば `aidlc-shared/nist-800-53-compliance.md`）に置き、ここからリンクします。

### 7. テスト（Testing）（共通）

```markdown
## Testing

| Test type | Required | Target | Tooling |
|-----------|----------|--------|---------|
| Unit | Yes | 80% line coverage | Jest / pytest |
| Integration | Yes | Every service-to-service call | Testcontainers |
| End-to-end | For key journeys | Critical user journeys | Playwright |
| Performance | When there are targets | The stated response times | k6 |
| Security | Yes | Every public endpoint | OWASP ZAP |

- **Mocking**: [Mock external dependencies, never internal business logic]
- **Test location**: [Next to the source, or a separate tests/ tree]
- **Naming**: [e.g. describe / it]

### Pipeline gates
| Pipeline step | Tests that must pass | On failure |
|---------------|----------------------|------------|
| Pull request | Unit and integration | Block the merge |
| Before staging deploy | End-to-end | Block the deploy |
```

ワークフローが書くテストの量は、その作業で選んだテスト戦略にも従います。[スコープ・深度・テスト戦略](../05-scopes-and-depth.md) を参照してください。

### 8. サンプルコード（Example Code）（共通）

サンプルコードは、よくある処理の正規のやり方を示します。そうすれば生成されるコードは、新しい書き方を発明せずにそれに従います。

プロジェクトにあるものについて、例を用意してください。プロジェクトの構成、API エンドポイント、データベースアクセス、エラー処理、認可の適用、単体テストと結合テスト、ログ出力、設定の読み込み、インフラのモジュールです。

例はリポジトリに置きます。たとえば:

```text
project-root/
  examples/
    api-endpoint/
      handler.ts          # working code, not pseudocode
      handler.test.ts     # how to test it
      README.md           # what it shows, when to use it, what to change
    database-access/
      repository.ts
      repository.test.ts
      README.md
```

各例は実際に動き、テストが付いていて、短い README を持つようにしてください。README には、どのパターンを示すか、いつ使い、いつ使わないか、どの部分を変えてよく、どの部分をそのまま保つかを書きます。

examples フォルダは単独では読まれません。どの例が何に当てはまるかをこの文書に書いてください。たとえば「すべての API エンドポイントは `examples/api-endpoint/` に従う」と書けば、Code Generation はそのステップを計画するときにそれを開きます。標準が変わったら例も最新に保ち、置き換えられた例は `deprecated-` の接頭辞を付けて名前を変え、後継を指す注記を添えてください。

### 9. 既存のコードベースのみ（Existing Codebase Only）

```markdown
## Existing Technical Inventory

- **Languages and frameworks, with versions**: [List]
- **Infrastructure and deployment**: [Services, model]
- **Test coverage today**: [Figure or a short assessment]
- **Known technical debt**: [Key items]

### Keep
| Technology | Reason to keep |
|------------|----------------|

### Migrate
| Today | Target | Priority | Approach |
|-------|--------|----------|----------|
| JavaScript | TypeScript | High | File by file |

### Remove
| Item | Reason | When |
|------|--------|------|

### While old and new coexist
- **API versions**: [How v1 and v2 run side by side]
- **Schema changes**: [How migrations run alongside existing data]
- **Feature flags**: [How new behaviour is switched on]
```

---

## 各セクションの使われ方

| セクション | ステージ | 使われ方 |
|---------|-------|----------------|
| プロジェクトの技術概要 | Practices Discovery | チームの実践とスキル |
| 言語、フレームワーク、ライブラリ | NFR Design、Code Generation | 何をどのバージョンで使い、何を決して足さないか |
| クラウドサービス | Feasibility & Constraints、Infrastructure Design | 設計が使ってよいサービス |
| アーキテクチャとパターン | Domain Design、Contract Design、Functional Design | 構造、API、データの決定 |
| セキュリティ | NFR Requirements、NFR Design、Build and Test | セキュリティ対策とその検査 |
| テスト | Code Generation、Build and Test、CI Pipeline | テストの種類、カバレッジ、ゲート |
| サンプルコード | Code Generation | 各コードが従うパターン |
| 既存の技術一覧 | Reverse Engineering、Practices Discovery | 何を維持し、移行し、取り除くか |

どのステージが実行されるかは、承認した計画によります。[フェーズとステージ](../04-phases-and-stages.md) を参照してください。
