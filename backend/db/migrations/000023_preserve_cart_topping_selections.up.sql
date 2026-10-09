BEGIN;

-- 商品との関連を変更しても、来場者の選択を削除しない。
ALTER TABLE cart_items
    DROP CONSTRAINT cart_items_menu_id_store_id_fkey,
    ADD CONSTRAINT cart_items_menu_id_store_id_fkey
        FOREIGN KEY (menu_id, store_id) REFERENCES menus(id, store_id) ON DELETE RESTRICT,
    ADD CONSTRAINT cart_items_id_menu_id_store_id_unique UNIQUE (id, menu_id, store_id);

ALTER TABLE cart_item_toppings ADD COLUMN store_id uuid;
UPDATE cart_item_toppings AS cit
SET store_id = ci.store_id
FROM cart_items AS ci
WHERE ci.id = cit.cart_item_id;
ALTER TABLE cart_item_toppings
    ALTER COLUMN store_id SET NOT NULL,
    DROP CONSTRAINT cart_item_toppings_cart_item_id_menu_id_fkey,
    DROP CONSTRAINT cart_item_toppings_menu_id_topping_id_fkey,
    ADD CONSTRAINT cart_item_toppings_item_fkey
        FOREIGN KEY (cart_item_id, menu_id, store_id)
        REFERENCES cart_items(id, menu_id, store_id) ON DELETE CASCADE,
    ADD CONSTRAINT cart_item_toppings_topping_fkey
        FOREIGN KEY (topping_id, store_id)
        REFERENCES toppings(id, store_id) ON DELETE RESTRICT;

CREATE INDEX cart_item_toppings_topping_id_store_id_idx
    ON cart_item_toppings (topping_id, store_id);

-- 旧アプリのINSERTはstore_idを指定しないため、DB更新とアプリ更新を合わせて行う。
COMMIT;
