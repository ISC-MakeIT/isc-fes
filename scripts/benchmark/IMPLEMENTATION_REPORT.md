# ベンチマーク実装レポート

## 実装したもの

Bun + TypeScript で、WS 専用と HTTP / WS 混合負荷を同じランナー上で実行する仕組みを追加した。
マシン計測と CloudWatch のクレジット取得は別スクリプトに分け、結果の結合・インスタンス比較はオフラインで行う。
利用手順は [README.md](./README.md)。バックエンド、DB schema、Terraform、デプロイ設定は変更していない。

通常起動は設定と計画を表示するだけ。明示的な `--execute` がある場合に負荷 / 計測 / AWS の読み取りを実行する。
実装時点では既存 API・WS・DB・AWS への実行は行っていない。small / medium の実測結果と推奨サイズはまだない。

## 既存コードから確認した仕様

| 項目 | 実装への反映 |
| --- | --- |
| `/ws/orders` は Origin の完全一致が必須 | 許可済みフロントエンド origin を設定から送信 |
| Guest session と Account session が独立 | 利用者 cookie と Staff cookie を分離 |
| Cart GET / Orders GET では Guest を新規発行しない | ramp の空 Cart PUT で cookie を発行して HTTP / WS に共有 |
| カート / 注文に楽観ロックがある | 最新 version、cart item ID、topping ID を使用 |
| 注文作成時には WS 通知されない | Staff のステータス更新で到達測定 |
| 通知は所有 Guest の全 WS へ注文一覧を送る | 1 Guest 複数タブと正確な注文 ID / status / version を照合 |
| 通常 Guest は active orders 上限 2 件 | pending → ready → completed を通して active order を解放 |
| 店舗側の注文一覧は 10 秒 polling | 注文作成とは独立の店舗 polling を追加 |
| API / PostgreSQL / Caddy が同じ EC2 に同居 | ホスト全体と各コンテナのリソースを収集 |
| Terraform は t4g.micro、credits は standard | small / medium を候補にし、standard のクレジット余裕も評価 |

## 推測で決めた条件

| 判断項目 | 初期値 / 理由 |
| --- | --- |
| 候補 family | 既存の ARM EC2 に合わせて t4g.small / t4g.medium |
| 混合負荷 | GET のみ 65%、Cart 25%、Checkout 10%。当日の実測がないため調整可能にした |
| 同接段階 | 混合: 100〜2000。WS 専用: 100〜4000。最大容量を断定せず、境界を探す初期範囲 |
| 操作開始レート | 5〜80 workflows/s。1 操作から複数 HTTP が発生するので、RPS と区別 |
| 店舗分布 | 例は 1 店舗への集中。複数 fixture + weight で実際の店舗分布 / 人気店に寄せる |
| 商品明細 | 1 メニュー、数量 1 → 2。任意のトッピング。画像 upload / 大きなカートは対象外 |
| 操作間隔 | 300ms ± 50%。ブラウザの操作待ちを簡略化 |
| 調理待ち | 1000ms ± 50%。注文更新を十分に発生させるため圧縮。実際の調理時間を再現した値ではない |
| 接続増加 | 25 connections/s。通常の来場増加として抑制。急激な再接続 storm は対象外 |
| Warmup / 測定 | 30 秒 / 原則 300 秒。HTTP baseline のみ 120 秒。soak は設定で延長 |
| WS タブ数 | 1。複数タブを測る場合は socketsPerGuest を増やす |
| インスタンス余裕 | CPU 最大 70%、メモリ最大 75%、swap なし |
| HTTP SLO | p95 500ms、p99 1500ms、失敗 1% 以下 |
| 通知 SLO | 成功 p95 1000ms、未到達 0.1% 以下、WS 維持率 99.9% 以上 |
| 想定稼働時間 | 8 時間。クレジット必要量に 25% の余裕を追加 |
| 比較するピーク | 固定しない。compare の --connections / --rate で予測ピーク + 余裕を指定 |

## 比較の仕組み

endpoint ごとの latency と失敗、操作全体の失敗、開始できなかった操作、WS 維持と通知を評価する。
成功した HTTP だけを集計して timeout を除外することはしない。
warmup と測定を分け、リクエストは開始時の段階に帰属させる。

不足したメトリクスやサンプル、負荷生成機の停滞では合格を出さない。
CPU クレジットのない t4g レポートも、容量観察には使えるがインスタンス判定は保留になる。
比較は同じバックエンド commit、負荷設定、fixture 名、SLO、スクリプト hash、生成機の Bun / OS / architecture / CPU 数を要求する。
DB snapshot の実際の同一性、EC2 / EBS 設定、回線条件は利用者が揃える。

small が指定負荷で全条件を満たせば small を暫定候補にする。
small の合格を確認できず medium が合格した場合は medium を候補にする。small が単に未計測の場合、medium の必要性を証明したとは扱わない。
両方未達 / 情報不足なら保留。変更していないサイズを推測で推奨することはない。

AWS の仕様上、t4g.small と t4g.medium はどちらも 2 vCPU、24 credits/h、CPU baseline 20%。
CPU が原因の劣化には medium への変更だけで改善する保証がなく、メモリ不足や DB / I/O の影響を読む必要がある。
クレジットは 5 分間隔の残高と測定した平均 CPU を使い、同じピーク負荷が稼働時間全体で続く条件を推定する。
[AWS: CPU credit table](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-credits-baseline-concepts.html)、[AWS: credit metrics](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-performance-instances-monitoring-cpu-credits.html)。

## 検証結果と範囲

- Bun 1.4.2 で型検査 `bun run typecheck:scripts` が成功。
- ネットワークなしの 20 テストが成功。固定レートの計算、histogram、接続数の時間積分、Linux カウンター、メトリクス結合、クレジット、比較条件、オフライン CLI のレポート出力、初期同期中のキャンセルを検証。
- メモリ上の transport で Guest cookie 更新、Staff 分離、Cart / Order の version、通知が HTTP 応答前に届く場合、WS timeout / 切断 / 不正メッセージを検証。
- API / WS の実接続、Linux collector / Docker stats の実行、AWS CLI export は未実行。
- 本番相当の性能、実際の同接上限、small / medium の適合性は未検証。初期 SLO と比率は測定後に当日の見込みと照らして調整する。

今後の測定では、専用の同じ DB snapshot を使い、候補ごとに WS 専用・混合負荷・3 回以上の反復・長時間 soak を行う。
既存 Guest の長い注文履歴、人気店舗への偏り、実際の調理待ち時間も fixture / 設定に反映する。
frontend SSR・画像 CDN・画像 upload・OAuth ログイン・ブラウザ描画・モバイル回線の再接続は今回の対象外。
DB プール、SQL、goroutine、GC の内部指標は今回収集していない。CPU / memory / I/O と endpoint の結果で原因を絞り、必要に応じて別途調べる。
