BEGIN;

CREATE TABLE store_allergens (
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    allergen_id UUID NOT NULL REFERENCES allergens(id) ON DELETE CASCADE,
    PRIMARY KEY (store_id, allergen_id)
);

-- 店舗内のいずれかのメニューで使用しているアレルゲンを、店舗単位に集約する。
INSERT INTO store_allergens (
    store_id,
    allergen_id
)
SELECT DISTINCT
    menus.store_id,
    menu_allergens.allergen_id
FROM menu_allergens
INNER JOIN menus
    ON menus.id = menu_allergens.menu_id;

DROP TABLE menu_allergens;

COMMIT;
