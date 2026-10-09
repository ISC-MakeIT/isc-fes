BEGIN;

-- 関連解除済みの選択は旧スキーマに戻せない。黙って削除せずrollbackを中止する。
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM cart_item_toppings AS cit
        WHERE NOT EXISTS (
            SELECT 1 FROM menu_toppings AS mt
            WHERE mt.menu_id = cit.menu_id AND mt.topping_id = cit.topping_id
        )
    ) THEN
        RAISE EXCEPTION 'Cannot restore menu_toppings FK while detached cart selections exist';
    END IF;
END $$;

DROP INDEX cart_item_toppings_topping_id_store_id_idx;
ALTER TABLE cart_item_toppings
    DROP CONSTRAINT cart_item_toppings_item_fkey,
    DROP CONSTRAINT cart_item_toppings_topping_fkey,
    DROP COLUMN store_id,
    ADD CONSTRAINT cart_item_toppings_cart_item_id_menu_id_fkey
        FOREIGN KEY (cart_item_id, menu_id)
        REFERENCES cart_items(id, menu_id) ON DELETE CASCADE,
    ADD CONSTRAINT cart_item_toppings_menu_id_topping_id_fkey
        FOREIGN KEY (menu_id, topping_id)
        REFERENCES menu_toppings(menu_id, topping_id) ON DELETE CASCADE;
ALTER TABLE cart_items
    DROP CONSTRAINT cart_items_id_menu_id_store_id_unique,
    DROP CONSTRAINT cart_items_menu_id_store_id_fkey,
    ADD CONSTRAINT cart_items_menu_id_store_id_fkey
        FOREIGN KEY (menu_id, store_id) REFERENCES menus(id, store_id) ON DELETE CASCADE;

COMMIT;
