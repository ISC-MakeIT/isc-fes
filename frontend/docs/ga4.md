# GA4 設定

フロントエンドは Vercel Production でのみ通常の GA4 イベントを送信する。Preview とローカルでは送信しない。GTM と BigQuery Export は使用しない。

## GA4 管理画面

1. GA4 プロパティと Web データストリームを作成する。タイムゾーンを日本、通貨を JPY にする。Web ストリームの測定 ID（`G-...`）を控える。
2. Web ストリームの「拡張計測機能」で「ページビュー → 詳細設定 → ブラウザの履歴イベントに基づくページの変更」をオフにする。コード側で初回と画面遷移の `page_view` を送るため、オンのままだと重複する。自動の離脱クリック、サイト内検索、フォーム操作、ファイルのダウンロードなどもオフにする。これらは URL や入力値を独自に正規化できない。
3. 「データの保持」でイベントデータを 14 か月にする。
4. 「カスタム定義」で以下をイベントスコープのカスタムディメンションとして登録する。`app_area`、`floor_number`、`store_id`、`menu_id`、`topping_id`、`item_type`、`decision`、`sold_out`、`selected`。商品 ID は GA4 標準の `item_id` を使うため登録しない。
5. 「データフィルタ」で Developer Traffic の除外フィルタを作り、テスト状態で確認後に有効化する。`debug_mode` 付きのローカル確認イベントを通常レポートから除外する。

## Vercel とローカル

Vercel の Production 環境に `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-...` を設定し、再デプロイする。`NEXT_PUBLIC_VERCEL_ENV` は Vercel が提供する値を使う。Preview に測定 ID が入っていても GA4 スクリプトは読み込まない。

ローカルから DebugView へ送るときだけ、`.env.local` に測定 ID と `NEXT_PUBLIC_GA_DEBUG_SEND=true` を設定して開発サーバーを再起動する。デバッグ送信をしないときはフラグを削除する。

## イベントと分析

すべての `page_view` に `app_area`（`guest`、`member`、`admin`）を付ける。ページ URL は動的 ID を画面名に置換し、招待 URL、`redirect_to`、任意のクエリは送らない。安全な形式の `utm_source`、`utm_medium`、`utm_campaign`、`utm_content` のみ保持する。外部参照元はオリジンまでに縮める。

| 領域 | イベント | 送信時点 |
| --- | --- | --- |
| 来場者 | `select_floor`、`select_store`、`view_store` | フロア・店舗の選択、店舗の表示 |
| 来場者 | `view_item_list`、`select_item`、`view_item` | 店舗のメニュー一覧表示、メニュー選択、詳細表示 |
| 来場者 | `topping_selection_changed` | トッピング選択の変更 |
| 認証 | `login_started` | Google ログイン開始。ログイン成功とは数えない |
| 店舗 | `store_application_submitted`、`store_profile_updated` | API 成功後 |
| 店舗 | `store_invitation_created`、`store_invitation_copied`、`store_member_removed` | 招待作成・コピー・削除の成功後 |
| 店舗 | `menu_created`、`menu_updated`、`menu_deleted`、`topping_created`、`topping_updated`、`topping_deleted`、`item_availability_changed` | API 成功後 |
| 管理者 | `store_application_reviewed` | 承認または却下の API 成功後 |

「レポート」でユーザー数、セッション、流入元、デバイス、エンゲージメント率・時間を確認する。「探索」で `app_area=guest` に絞り、`page_view`（`/`）→`view_store`→`view_item` のファネルを作る。別の自由形式探索で店舗・管理者のイベント名と `store_id`、`decision` を比較する。注文・調理・受け渡しは画面が準備中のため、現時点ではページビューのみを計測する。

## 動作確認

- ローカル・Preview の通常表示では `gtag/js` と `g/collect` への通信がない。
- DebugView で初回表示と画面遷移それぞれに `page_view` が一件だけ届き、操作イベントとパラメータが届く。
- `page_location`、`page_referrer`、イベントのパラメータに招待 ID、ログインのリダイレクト先、個人情報が含まれない。
