# GA4 設定

フロントエンドは Vercel Production でのみ通常の GA4 イベントを送信する。Preview とローカルでは送信しない。GTM と BigQuery Export は使用しない。

## GA4 管理画面

1. GA4 プロパティと Web データストリームを作成する。タイムゾーンを日本、通貨を JPY にする。Web ストリームの測定 ID（`G-...`）を控える。
2. Web ストリームの「拡張計測機能」で「ページビュー → 詳細設定 → ブラウザの履歴イベントに基づくページの変更」をオフにする。コード側で初回と画面遷移の `page_view` を送るため、オンのままだと重複する。自動の離脱クリック、サイト内検索、フォーム操作、ファイルのダウンロードなどもオフにする。これらは URL や入力値を独自に正規化できない。
3. 「データの保持」でイベントデータを 14 か月にする。
4. 「カスタム定義」で以下をイベントスコープのカスタムディメンションとして登録する。`app_area`、`floor_number`、`store_id`、`menu_id`、`topping_id`、`item_type`、`decision`、`sold_out`、`selected`、`trigger`。商品 ID は GA4 標準の `item_id` を使うため登録しない。
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
| 来場者 | `cart_item_added` | カート更新 API 成功・応答検証後、保存前より合計数量が増えたとき |
| 来場者 | `checkout_started` | 商品の入った注文確認画面の表示時 |
| 来場者 | `order_placed` | 注文作成 API 成功・応答検証後。店頭決済前の注文確定 |
| 来場者 | `order_wait_blocked` | 注文作成 API が初回閲覧後の待機制限で拒否したとき |
| 認証 | `login_started` | Google ログイン開始。ログイン成功とは数えない |
| 店舗 | `store_application_submitted`、`store_profile_updated` | API 成功後 |
| 店舗 | `store_invitation_created`、`store_invitation_copied`、`store_member_removed` | 招待作成・コピー・削除の成功後 |
| 店舗 | `menu_created`、`menu_updated`、`menu_deleted`、`topping_created`、`topping_updated`、`topping_deleted`、`item_availability_changed` | API 成功後 |
| 管理者 | `store_application_reviewed` | 承認または却下の API 成功後 |
| アンケート | `open_review`、`submit_review` | ダイアログ表示時と送信 API 成功後。表示契機を `trigger` に設定する |

「レポート」でユーザー数、セッション、流入元、デバイス、エンゲージメント率・時間を確認する。「探索」で `app_area=guest` に絞り、`page_view`（`/`）→`view_store`→`view_item`→`cart_item_added`→`checkout_started`→`order_placed` の流れを確認する。店舗・管理者の既存イベントは別の自由形式探索でイベント名と `store_id`、`decision` を比較する。

注文確認は `/stores/:storeId/checkout`、注文詳細は `/orders/:orderId` としてページビューを送る。実際の ID はページ URL に含めない。

### カート・注文の計測方針

- 今回追加した `cart_item_added`、`checkout_started`、`order_placed` は、操作の発生だけを数えるカスタムイベント。独自パラメータは付けず、既存の共通情報である `app_area`、ID を伏せた `page_location`、デバッグ時の `debug_mode` のみを付ける。
- 注文 ID・店舗 ID・商品明細・トッピング・数量・金額は、この3イベントには送らない。既存の閲覧イベントや `order_wait_blocked` のパラメータは従来どおり。
- カート更新の前後で合計数量を比較し、数量が増えた場合に `cart_item_added` を一件送る。数量上限などで変更がない場合、数量減少、全削除、トッピング変更では送らない。
- `checkout_started` は空でない注文確認画面で送る。同一画面の再レンダーによる重複を抑える。
- `order_placed` は注文作成 API 成功・応答検証後に送る。注文 ID は同じページ実行中の重複防止のためにメモリ内だけで使う。再読み込みや別端末をまたいだ厳密な一回送信は保証しない。
- `order_placed` は店頭決済前の注文確定。呼び出し・キャンセル・店頭決済のイベントは GA4 に送らない。
- 正確な注文件数・売上・商品別集計・調理時間・キャンセル率・詳細な分析は、バックエンドの注文データや必要な履歴を使う。GA4 にはブラウザの通信遮断などによる欠測もある。

### その他の未計測箇所（目的が決まった場合の検討候補）

- 混雑状況の更新、店舗の開閉、モバイルオーダー受付設定の変更は個別のイベントを送っていない。運営状況の詳しい分析は、まず DB のデータや必要な履歴で扱う。
- イベントバナーの選択：`event-banners.tsx` のリンク選択。遷移先の `/events` とランキングの `/ranking` も、現在のページビューでは `/other` に正規化される。
- 注文確認前の拒否理由：`cart-operation-context.tsx` の事前チェックは、閉店・受付停止・注文数上限などの理由コードを取得しているが、GA4 には送っていない。既存の `order_wait_blocked` は注文作成時の待機制限のみを数える。

## 動作確認

- ローカル・Preview の通常表示では `gtag/js` と `g/collect` への通信がない。
- DebugView で初回表示と画面遷移それぞれに `page_view` が一件だけ届き、操作イベントとパラメータが届く。
- `page_location`、`page_referrer`、イベントのパラメータに招待 ID、ログインのリダイレクト先、個人情報が含まれない。
- カートの数量が増えた場合のみ `cart_item_added` が届き、失敗・数量上限・削除・トッピング変更では届かない。
- 注文確認画面の再レンダーで `checkout_started` が増えず、注文詳細の再表示だけでは `order_placed` が発火しない。
- 追加した3イベントに注文 ID・店舗 ID・商品明細・数量・金額が含まれず、店舗側の呼び出し・キャンセル・決済完了操作では操作イベントが届かない。
