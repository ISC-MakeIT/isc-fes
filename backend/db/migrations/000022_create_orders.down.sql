-- 開発検証用。成立済み注文のある本番環境では実行しない。
BEGIN;

DROP TABLE store_order_counters;
DROP TABLE order_item_toppings;
DROP TABLE order_items;
DROP TABLE orders;
ALTER TABLE carts DROP CONSTRAINT carts_id_guest_id_store_id_unique;
DROP TYPE order_status;

COMMIT;
