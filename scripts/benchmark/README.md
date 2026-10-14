# Bun performance benchmarks

WS 容量と HTTP + WS の混合負荷を測り、対象サーバーの CPU・メモリ・I/O と結合して `t4g.small` / `t4g.medium` を比較する。
実装時には既存環境へのアクセスも負荷実行も行っていない。
仕様を決めた理由、仮定、検証範囲は [IMPLEMENTATION_REPORT.md](./IMPLEMENTATION_REPORT.md) に記載。

## 構成

| 用途 | エントリーポイント / 設定 |
| --- | --- |
| WS 同接と初期同期の容量測定 | `bun run benchmark` + `ws.example.json` |
| 来場者の GET・Cart・Order + WS 通知 | `bun run benchmark` + `mixed.example.json` |
| 対象 Linux のマシン計測 | `bun run benchmark:metrics` |
| CloudWatch CPU クレジット取得 | `bun run benchmark:credits` |
| 結果集計 / インスタンス比較 | `bun run benchmark report` / `compare` |

実行には Bun 1.4.1 以降を使用する。開発依存は既存の Bun 型定義と TypeScript のみ。
デフォルトは計画表示。`run --execute` で初めて API / WS へアクセスする。
collector と credits exporter も `--execute` が必要。`report` / `compare` はファイルだけを読む。

## 負荷モデル

- 各段階は接続増加 → warmup → measure → drain。増加時は既存 WS を維持する。段階を縮小すると余分な WS を閉じる。
- Guest の cookie は利用者ごとに独立。最初の空 Cart PUT で Guest セッションを取得し、HTTP と WS で共有する。この初期処理は ramp に分けて記録する。
- `socketsPerGuest` は同じ Guest の複数タブを表す。同接数はこの値の倍数にする。
- WS の成功は `connection.ready` を受信した時点。アプリケーションデータは送信しない。サーバーの ping に対する pong は Bun が処理する。
- HTTP の `workflowsPerSecond` は **来場者の一連の操作の開始数/s**。HTTP RPS ではない。読み込み待ちでも開始予定数を減らさず、同じ Guest の操作中 / `maxInFlight` 到達 / スケジューラー停滞時は drop を記録する。
- GET のみ 65%、Cart 操作 25%、Checkout 10% を初期値とする。GET は店舗一覧・店舗詳細・メニュー・トッピング・注文一覧、GET のみの利用者は教室・アレルゲンも取得する。
- Cart は取得 → 追加 → 数量変更 → 削除。Checkout は削除の代わりに注文作成 → 注文詳細 → 店舗側 ready → completed と進む。サーバーの version と明細 ID を使用する。
- 店舗側は 10 秒ごとに pending/ready 一覧を polling。Checkout にもスタッフの cookie が必要。来場者 cookie と組み合わせず、注文の所有 Guest が変わらないようにする。
- 通知は PATCH より前に待ち受ける。`changedOrderId` と注文の ID / status / version が一致した時点で成功。測定値は PATCH 開始直前から受信までで、HTTP 処理時間を含む。
- 同じ段階内では自動リトライ・再接続を行わず、失敗を接続維持と到達率に反映する。次の段階の ramp では切断済みの WS を作り直し、正常な既存接続は維持する。再接続を含むモバイル回線の挙動は今回の測定対象外。
- 乱数 seed を固定する。レスポンス時間によってどの利用者が空いているかは変わるため、同じ seed でも通信順序の完全一致は保証しない。

## まず計画だけを確認する

```sh
bun run benchmark plan --config scripts/benchmark/mixed.example.json
bun run benchmark plan --config scripts/benchmark/ws.example.json
```

例のホストは `.invalid`、ID とコミットは仮の値。専用のベンチマーク環境に合わせて `*.local.json` を作る。
次を設定する。

| 設定 | 意味 |
| --- | --- |
| `label` | run ごとの識別名。Linux collector とクレジットファイルにも同じ値を使う |
| `instanceType` | `t4g.small` または `t4g.medium` |
| `targetInstanceId` | 測定対象 EC2 の instance ID。run の設定に保存し、マシン計測・クレジットの両方と照合する |
| `backendCommit` | 対象の `/health` の `commitHash`。実行前に一致を検証する |
| `databaseFixture` | 同じ DB 初期状態を表す任意の名前。実際の同一性は利用者が保証する |
| `baseUrl` | 対象 API の origin。HTTPS / Caddy を含む本番と同じ通信経路を推奨 |
| `origin` | 対象バックエンドの `CORS_ALLOWED_ORIGINS` に登録したフロントエンド origin |
| `stores` | 承認済み店舗 / 販売可能なメニュー / そのメニューに紐づく販売可能なトッピング |
| `staffCookieEnv` | その店舗の Staff / Manager のログイン cookie を持つ環境変数名 |
| `weight` | 店舗選択の相対確率。複数店舗と人気店舗への偏りを設定できる |

Staff cookie の値は `isc_fes_account_session=<token>` の **1 cookie のみ**。設定ファイルに token を書かない。
`baseUrl` が `targetInstanceId` の EC2 を指すことは実行前に確認する。URL と EC2 の対応を自動検証する機能はない。
公開 API の fixture 検証とスタッフの権限検証に通ってから Guest / Cart を作成する。
通常の OAuth ログインはスクリプトでは行わない。WS 専用設定ではスタッフのログインは不要。

## 後で実行する手順

以下は実行例。small と medium は同じバックエンドイメージ、DB snapshot、PostgreSQL / Caddy / EBS 設定、seed、SLO を使う。
負荷生成機は対象 EC2 と分け、同じ PC / Bun バージョン / ネットワーク条件で比較する。
DB の既存注文数や各 Guest の注文履歴の長さも揃える。

1. ベンチマーク専用の DB / 店舗 / Staff セッションを準備し、設定の仮値を置き換える。
2. 対象 Linux ホストにこのディレクトリと Bun を用意する。API / DB / Caddy が同居する **ホスト上** で collector を起動する。コンテナ内ではホストのメモリ使用率を正しく比較できない。collector は [IMDSv2 の instance identity document](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-identity-documents.html) から実際の instance ID と型を取得するため、ホストから IMDSv2 にアクセスできることが必要。
3. 別マシンで負荷生成を実行する。
4. collector のファイルを負荷生成機へコピーし、CloudWatch の最後の datapoint が公開された後にクレジットを取得する。
5. オフラインで結合・比較する。

対象ホスト上の collector（負荷生成の前から、終了後まで記録する）:

```sh
bun run scripts/benchmark/collect-metrics.ts \
  --label small-1 --instance-type t4g.small \
  --seconds 3600 --interval 5 --docker \
  --out /tmp/small-1.metrics.jsonl --execute
```

負荷生成機:

```sh
# BENCH_STAFF_COOKIE は対象ベンチマーク環境の Staff cookie を環境変数として設定済みにする
bun run benchmark run --config scripts/benchmark/mixed.local.json \
  --out benchmark-results/small-1 --execute
```

`--out` は新規ディレクトリが必須。実行を中断した場合も WS を閉じ、進行中の HTTP をキャンセルし、結果を保存する。
レポートの判定は中断・失敗した run をインスタンス推奨の根拠にしない。

CloudWatch export は AWS CLI と `cloudwatch:GetMetricData`、`ec2:DescribeInstances`、`ec2:DescribeInstanceCreditSpecifications` 権限が必要。
指定した instance ID が run の `targetInstanceId` と一致することに加え、AWS が返す instance ID / type と credit mode を確認し、run 前後のクレジットを取得する。AWS / EC2 の設定は変更しない。

```sh
bun run benchmark:credits --result benchmark-results/small-1/result.json \
  --instance-id i-0123456789abcdef0 --region ap-northeast-1 \
  --out benchmark-results/small-1/credits.json --execute

bun run benchmark report --result benchmark-results/small-1/result.json \
  --metrics /path/to/small-1.metrics.jsonl \
  --credits benchmark-results/small-1/credits.json \
  --out benchmark-results/small-1
```

クレジットは 5 分間隔。export は測定前 5 分〜測定後 10 分を対象とする。
測定終了直後は最後の点がまだ公開されていないことがある。前後の点が不足する場合は後で export をやり直す。
`standard` のみを対象とし、`unlimited` の追加料金を含む比較は扱わない。

medium でも同じ手順を行う。設定の `label`、`instanceType`、`targetInstanceId`、URL / origin 以外は揃える。
再実行する場合は専用 DB を同じ snapshot に戻し、出力先と label を変える。

```sh
# 例: 予測ピーク 1000 WS / 40 workflows/s に 50% の余裕を求める
bun run benchmark compare \
  --small benchmark-results/small-1/report.json \
  --medium benchmark-results/medium-1/report.json \
  --connections 1500 --rate 60 --out benchmark-results/comparison
```

この場合は例の `mixed-2000 / 80 workflows/s` 段階が要件を満たす候補になる。
WS 専用の比較では `--rate 0` を使う。WS 専用で合格しても混合負荷の根拠にはしない。

## メトリクスと出力

| ファイル | 内容 |
| --- | --- |
| `result.json` | run 状態・設定・バックエンドコミット・スクリプト hash・生成機情報・段階ごとの ramp/warmup/measure |
| `timeline.jsonl` | 測定中 1 秒ごとの ready WS 数・進行中操作・drop・負荷生成機 CPU / RSS |
| `report.json` / `report.md` | endpoint ごとの件数・失敗・status 別内訳・p50/p95/p99/max・WS 通知・target metrics・SLO 判定 |
| `comparison.json` / `comparison.md` | 指定したピーク + 余裕に対する small / medium の暫定判定 |
| `*.metrics.jsonl` | Linux の CPU / iowait / steal・MemAvailable ベースのメモリ使用率・swap・load・FD・PSI・NIC 別帯域・disk 別 IOPS / 転送量 / busy・Docker stats |
| `credits.json` | run / instance 情報と CloudWatch CPUCreditBalance / CPUCreditUsage |

HTTP の latency は本文読み込みと JSON 検証まで含む。timeout・409・401・不正な成功レスポンスも失敗として数える。
百分位は上側境界の対数 histogram（約 2% 誤差）を用い、長時間の測定でも全 latency をメモリに保持しない。
通知は成功分の p95 と全期待通知に対する未到達率を分ける。
WS 維持率は接続数 × 時間の積分で求める。Guest ごとの通知であり、全利用者への一斉 broadcast ではない。

measure 終了後の drain も開始した段階に帰属させ、warmup とは混ぜない。
そのため HTTP 件数 / 観測時間は概算 throughput。target metrics の結合対象は measure の時刻範囲のみ。
collector の時刻は UTC、カウンター差分は単調時計を使う。生成機 / 対象ホストとも NTP で時計を合わせる。
90% 未満のカバー率・15 秒超の欠落・別 label / instance type / instance ID のメトリクスを、揃った証拠として扱わない。ファイル内の hostname の混在も拒否する。
`targetInstanceId` のない旧設定・run や、instance ID のない旧マシン計測は読み込めない。新しい設定で再計測する。
NIC / disk は個別に記録し、veth・bridge・partition を一緒に足して二重計上しない。
Docker stats は `--docker` のときだけ。権限不足 / timeout は `dockerError` として残す。

## 判定と次の測定

初期 SLO は HTTP p95 ≤ 500ms / p99 ≤ 1500ms、HTTP と操作全体の失敗 ≤ 1%、通知成功 p95 ≤ 1000ms / 未到達 ≤ 0.1%、WS 維持率 ≥ 99.9%、drop ≤ 1%、CPU 最大 ≤ 70%、メモリ最大 ≤ 75%、swap なし。
endpoint ごとに最低 30 サンプルを求める。低負荷 / 短時間の段階では意図的に `inconclusive` になる。
生成機のイベントループ遅延 p99 > 100ms または最大 > 500ms は、サーバーの容量を判定できない状態とする。

CPU クレジットは、測定中の平均 CPU から `max(0, 2 × 60 × CPU% / 100 − 24)` credits/h の純減を計算し、8 時間 + 25% 余裕の残高を求める。
これは稼働時間を通じて同じ負荷が続く仮定の推定。クレジット不足時の実測を置き換えない。
small と medium の vCPU / baseline は同じ。メモリ不足の改善と、CPU・DB ロック・I/O のボトルネックを区別して結果を読む。

最初は WS 専用 → 混合負荷 → 予測ピーク付近の段階を 3 回ずつ → 30〜60 分以上の soak の順に進める。
soak は同じ JSON の `stages` を 1 段階にして `durationSeconds` を 1800〜3600 にする。
さらに調理待ち時間を実運用に寄せる場合は `kitchenDelayMs` を増やし、その間の利用者を保持できる `httpUsers` / `maxInFlight` を用意する。
段階の WS / HTTP レートを独立に変更して、同接と操作量のどちらで劣化するかを切り分ける。
一回の pass は絶対的な最大同接や当日負荷の保証ではない。p99 の判断にはより多くのサンプルを集める。

Guest・Cart・Order・注文番号カウンターは永続化される。自動削除 / DB 初期化はしない。
バックエンドの失敗が起きた注文は pending/ready のまま残る可能性があり、失敗率と次の操作に反映される。
検証専用 DB を使い、測定後はその環境のデータを処分する。

## 開発時の検証

```sh
bun run typecheck:scripts
bun run test:benchmark
```

テストは純粋な計算とメモリ上の HTTP / WS transport を使用する。API サーバーや AWS に接続しない。
