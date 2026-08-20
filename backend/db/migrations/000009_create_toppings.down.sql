DROP TABLE menu_toppings;
DROP TABLE toppings;

-- 旧版の000009を適用済みのローカルDBでもdownできるようにする。
ALTER TABLE menus
    DROP CONSTRAINT IF EXISTS menus_id_store_id_unique;
