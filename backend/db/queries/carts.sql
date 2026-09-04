-- name: GetCartByGuestIDAndStoreID :many
SELECT
    carts.id AS cart_id,
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
INNER JOIN cart_items
    ON cart_items.cart_id = carts.id
    AND cart_items.store_id = carts.store_id
INNER JOIN menus
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