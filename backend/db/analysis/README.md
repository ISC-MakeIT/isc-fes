# activity_log

業務データと同じトランザクションで、成立した変更を記録する。ログ保存に失敗した変更はロールバックされる。
GET、失敗、同値更新、注文再送は記録しない。アプリからは追記のみ行い、削除・保持期限・外部APIは設けない。

## 導入

1. 旧バックエンドの書き込みを停止し、実行中の取引が完了するまで待つ。
2. `000025_create_activity_log` を適用する。全店舗と未削除の商品について、関連IDを含むbaselineが共通時刻で作成される。
3. ログ対応バックエンドを起動し、書き込みを再開する。旧バージョンとの同時稼働は履歴に欠落を生むため行わない。

マイグレーションは関連テーブルをロックして初期記録の整合性を保つ。baselineは過去の作成イベントではない。
空のDBに適用した場合はbaselineも空になる。downマイグレーションは履歴テーブルを削除するため、履歴が必要な場合は事前に退避する。

## 保存形式

`payload_version=1`。変更時は `before` / `after` に変更項目のみ、作成・baselineは `before=null` と業務情報、削除は業務情報と `after=null` を保存する。
注文更新の `context.version` は更新後の注文version。トッピング削除の `context.affected_menu_ids` は関連解除されたメニューID集合。
各メニューの関連解除も `menu.updated` に記録し、`context.cause=topping.deleted` と `context.topping_id` を保存する。
ID集合はソートして比較する。業務項目には画像のオブジェクトキーを含むが、画像ファイルの保存・復元は行わない。
メール、セッショントークン、HTTP本文は保存しない。IDには外部キーがなく、対象・操作者の削除後もIDと変更内容が残る。

## 分析SQL

リポジトリルートから、読み取り用のDB接続で実行する。期間は開始以上・終了未満。タイムゾーン付き日時を指定する。

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v start_at='2026-10-01T00:00:00+09:00' \
  -v end_at='2026-11-01T00:00:00+09:00' \
  -f backend/db/analysis/state_intervals.sql
```

- `state_intervals.sql`: 商品の売り切れ、店舗の受付停止・閉店の区間と秒数。期間開始前の最後の観測も使い、終了時刻まで続く区間を含む。削除で商品区間を終了する。baselineより前は推測しない。
- `order_times.sql`: 注文テーブルに保存済みの時刻から調理・受け渡し・キャンセル待ち時間を計算する。未到達の時刻はNULLで、ゼロ秒とは区別する。
- `actor_history.sql`: 変更履歴。追加で `-v account_id='' -v guest_id=''` を指定する。空文字は絞り込みなし。両方指定した場合はAND条件。
- `daily_activity.sql`: 日本時間の日別・店舗別・操作者別のイベント件数。baselineは除外する。副作用のメニュー更新も件数に含まれるため、HTTP操作数とは異なる。

長い集計中に書き込みが続く場合、複数SQLの同一時点での比較には読み取り専用のREPEATABLE READ取引を使う。
同時刻のイベントID順は表示上の順序であり、UUIDは変更順序を保証しない。注文の厳密な更新順は `context.version` を使う。

## テスト

```sh
cd backend
TEST_ACTIVITY_DATABASE_URL='postgres://isc-fes:devpassword@localhost:5432/isc-fes?sslmode=disable' \
TEST_ORDER_DATABASE_URL='postgres://isc-fes:devpassword@localhost:5432/isc-fes?sslmode=disable' \
go test ./...
```

統合テストはランダムな専用schemaでマイグレーション・失敗注入を実施し、終了後にそのschemaだけを削除する。接続先にはschema作成権限が必要。
