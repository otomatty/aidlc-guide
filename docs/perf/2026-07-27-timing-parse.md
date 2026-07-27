# `/api/timings` パフォーマンスベースライン (2026-07-27)

## これは何の記録か

`GET /api/timings`（ステージ経過/残りの算出元。Task 5 で追加）が
NFR-2 の 3秒予算を侵していないかを、モックではなく実 API 経路
（`createGuideService` → `routeRead`）で計測した記録。

**重要な前提**: `/api/timings` は ADR-03「段階的初回描画」により
**初回描画のクリティカルパス外**に置かれている。`GET /api/workflow` が
`aidlc-state.md` 1枚のパースのみで即応答し、Now strip / Stage rail を
先に描画する。593ファイル全走査（Unit×Stage マトリクス・監査ログ全走査）
は初回応答後の背景処理であり、`/api/timings` の監査ログ走査もこの
バックグラウンド経路に属する。

したがって **この計測値は NFR-2 の3秒予算の消費内訳ではない**。
`/api/timings` がどれだけ遅くなっても、それだけでは NFR-2 は破られない
（クリティカルパスに乗っていないため）。この記録は「今後この数値が
大きく劣化していないか」を検知するための**回帰検知の基準線**である。

## 計測対象

- 経路: 実 API ハンドラ全体（`packages/api-core/src/service.ts` の
  `createGuideService` → `packages/api-core/src/handlers/read.ts` の
  `routeRead`、URL `http://x/api/timings`）。内部関数の直接呼び出しでは
  なく、リクエストルーティングからレスポンス生成までを通しで計測。
- 応答確認: `res.status === 200`、`res.body.ok === true` で実データ
  （ステージ別 `timings` 配列）が返ることを目視確認済み。

## 監査ログのサイズ（`/api/timings` が走査する量）

計測時点でのワークスペース（`aidlc/spaces/default/intents/260720-aidlc-guide-prd/`）の
監査ログシャード:

```
$ wc -l aidlc/spaces/default/intents/260720-aidlc-guide-prd/audit/*.md
   752 saedgewell-142cdb1f3035.md
   624 saedgewell-a871eea20ce1.md
 33345 saedgewell-e0d17071eca8.md
 34721 total

$ grep -c '^\*\*Event\*\*:' aidlc/spaces/default/intents/260720-aidlc-guide-prd/audit/*.md
saedgewell-142cdb1f3035.md:90
saedgewell-a871eea20ce1.md:92
saedgewell-e0d17071eca8.md:3295
TOTAL: 3477 events
```

（参考: 本タスクの計画立案時点で行われた、監査ログ全走査単体のアドホック
計測は 3,395 イベント / 33,345 行に対して 12–48ms だった。今回の計測は
それより新しいイベント数を含む3ファイル・3,477 イベント / 34,721 行に
対する、エンドポイント全体を通した数値であり、単体関数計測より大きく
出るのは想定どおり。）

## 計測コマンド

```bash
bun -e 'const {createGuideService}=await import("./packages/api-core/src/service.ts");const {routeRead}=await import("./packages/api-core/src/handlers/read.ts");const s=createGuideService({workspaceRoot:process.cwd()});const u=new URL("http://x/api/timings");const hit=async()=>{const t=performance.now();await routeRead(s.readContext,u);return performance.now()-t};const cold=await hit();const w=[];for(let i=0;i<50;i++)w.push(await hit());w.sort((a,b)=>a-b);const q=(p)=>w[Math.min(w.length-1,Math.floor(w.length*p))].toFixed(1);console.log(JSON.stringify({cold:cold.toFixed(1),warm:{min:w[0].toFixed(1),p50:q(0.5),p95:q(0.95),max:w[w.length-1].toFixed(1)}},null,2))'
```

ブリーフの一行をそのまま実行（変更なし）。

## 実測値（ミリ秒）

```json
{
  "cold": "151.3",
  "warm": {
    "min": "72.4",
    "p50": "90.5",
    "p95": "106.4",
    "max": "112.0"
  }
}
```

- **cold**: 同一 `bun` プロセス内での**1回目の呼び出し**。この worktree
  では直前の別コマンド実行により OS のページキャッシュがすでに温まって
  いた可能性が高く、真にキャッシュコールドな状態（再起動直後）を意図的に
  再現したものではない。ここでの "cold" が指すのは「新規プロセスの初回
  1発」であり、「ディスクキャッシュが冷えた初回」ではない点を明記する。
  後者を厳密に取るには、OS 再起動直後や `sync && echo 3 > /proc/sys/vm/drop_caches`
  相当（Windows では対応する手段なし）が必要で、本環境では実施していない。
- **warm**: 同一プロセス内で続けて 50 回呼び出した分布（min / p50 / p95 / max）。
  平均値は記録しない（project.md performance-validation の学習に従う）。

いずれも 3秒（NFR-2 の全体予算）は元より、100ms 台であり大きな余裕がある。
ただし前述のとおりこれは予算消費の証明ではなく、将来の劣化を検知する
ための基準値としての意味を持つ。

## フィクスチャの汚染確認

計測前後で監査ログファイルのサイズ・行数が変化していないことを確認済み
（`wc -l` / `ls -la` の前後比較で同一）。計測は読み取りのみで、監査ログや
`aidlc/` 配下への書き込みは発生していない。

```
$ git status --porcelain aidlc/
?? aidlc/spaces/default/intents/260720-aidlc-guide-prd/audit/saedgewell-142cdb1f3035.md
```

この1行は本タスク開始前から存在していた未追跡ファイル（本 worktree の
セッション自身の監査シャード。フレームワークの監査フック — Task 9 とは
無関係 — が本セッションの活動に応じて追記しているもので、`/api/timings`
の計測コマンドが書き込んだものではない）。計測コマンド実行前後で当該
ファイルのサイズ・行数を比較し、変化がないことを確認済み（上記）。
`docs/perf/2026-07-27-timing-parse.md` 以外に、本タスクが `aidlc/` 配下へ
書き込んだファイルは無い。
