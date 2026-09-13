-- name: GetCartByGuestIDAndStoreID :many
SELECT
    carts.id AS cart_id,
    carts.version AS cart_version,
    carts.guest_id,
    carts.store_id,

    cart_items.id AS cart_item_id,
    cart_items.quantity AS cart_item_quantity,
    cart_items.created_at AS cart_item_created_at,

    menus.id AS menu_id,
    menus.name AS menu_name,
    menus.unit_price AS menu_unit_price,
    menus.image_object_key AS menu_image_object_key,
    menus.sold_out AS menu_sold_out,
    menus.deleted_at AS menu_deleted_at,

    cart_item_toppings.id AS cart_item_topping_id,

    toppings.id AS topping_id,
    toppings.name AS topping_name,
    toppings.unit_price AS topping_unit_price,
    toppings.sold_out AS topping_sold_out,
    toppings.deleted_at AS topping_deleted_at
FROM carts
LEFT JOIN cart_items
    ON cart_items.cart_id = carts.id
    AND cart_items.store_id = carts.store_id
LEFT JOIN menus
    ON menus.id = cart_items.menu_id
    AND menus.store_id = cart_items.store_id
LEFT JOIN cart_item_toppings
    ON cart_item_toppings.cart_item_id = cart_items.id
    AND cart_item_toppings.menu_id = cart_items.menu_id
LEFT JOIN toppings
    ON toppings.id = cart_item_toppings.topping_id
WHERE carts.guest_id = sqlc.arg(guest_id)
  AND carts.store_id = sqlc.arg(store_id)
ORDER BY
    cart_items.created_at ASC,
    cart_items.id ASC,
    toppings.id ASC;


-- name: CreateCart :one
INSERT INTO carts (guest_id, store_id)
VALUES (sqlc.arg(guest_id), sqlc.arg(store_id))
RETURNING *;

-- name: BumpCartVersion :one
UPDATE carts
SET version = version + 1
WHERE guest_id = sqlc.arg(guest_id)
  AND store_id = sqlc.arg(store_id)
  AND version = sqlc.arg(expected_version)
RETURNING id, version;

-- name: UpsertCartItems :execrows
INSERT INTO cart_items (
    id,
    cart_id,
    menu_id,
    store_id,
    quantity
)
SELECT
    input.id,
    sqlc.arg(cart_id),
    input.menu_id,
    sqlc.arg(store_id),
    input.quantity
FROM ROWS FROM (
    unnest(sqlc.arg(item_ids)::uuid[]),
    unnest(sqlc.arg(menu_ids)::uuid[]),
    unnest(sqlc.arg(quantities)::integer[])
) AS input(id, menu_id, quantity)
ON CONFLICT (id) DO UPDATE SET
    quantity = EXCLUDED.quantity
WHERE cart_items.cart_id = EXCLUDED.cart_id
  AND cart_items.store_id = EXCLUDED.store_id
  AND cart_items.menu_id = EXCLUDED.menu_id;

-- name: DeleteCartItemsNotIn :exec
DELETE FROM cart_items
WHERE cart_id = sqlc.arg(cart_id)
  AND NOT (
      id = ANY(sqlc.arg(remaining_item_ids)::uuid[])
  );

-- name: InsertCartItemToppingsIfNotExists :exec
INSERT INTO cart_item_toppings (
    cart_item_id,
    menu_id,
    topping_id
)
SELECT DISTINCT
    ci.id,
    ci.menu_id,
    desired.topping_id
FROM ROWS FROM (
    unnest(sqlc.arg(cart_item_ids)::uuid[]),
    unnest(sqlc.arg(topping_ids)::uuid[])
) AS desired(cart_item_id, topping_id)
INNER JOIN cart_items AS ci
    ON ci.id = desired.cart_item_id
WHERE ci.cart_id = sqlc.arg(cart_id)
  AND ci.store_id = sqlc.arg(store_id)
ON CONFLICT (cart_item_id, topping_id) DO NOTHING;

-- name: DeleteCartItemToppingsNotIn :exec
DELETE FROM cart_item_toppings AS cit
USING cart_items AS ci
WHERE ci.id = cit.cart_item_id
  AND ci.cart_id = sqlc.arg(cart_id)
  AND ci.store_id = sqlc.arg(store_id)
  AND NOT EXISTS (
      SELECT 1
      FROM ROWS FROM (
          unnest(sqlc.arg(cart_item_ids)::uuid[]),
          unnest(sqlc.arg(topping_ids)::uuid[])
      ) AS desired(cart_item_id, topping_id)
      WHERE desired.cart_item_id = cit.cart_item_id
        AND desired.topping_id = cit.topping_id
  );