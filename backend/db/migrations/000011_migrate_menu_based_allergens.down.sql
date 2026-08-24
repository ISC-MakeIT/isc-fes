BEGIN;

CREATE TABLE menu_allergens (
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    allergen_id UUID NOT NULL REFERENCES allergens(id) ON DELETE CASCADE,
    PRIMARY KEY (menu_id, allergen_id)
);

-- 店舗単位のアレルゲンを、同じ店舗の全メニューに関連付けて復元する。
-- 元のメニューごとの関連は復元できないため、安全側に倒して過少表示を避ける。
INSERT INTO menu_allergens (
    menu_id,
    allergen_id
)
SELECT
    menus.id,
    store_allergens.allergen_id
FROM store_allergens
INNER JOIN menus
    ON menus.store_id = store_allergens.store_id;

DROP TABLE store_allergens;

COMMIT;
