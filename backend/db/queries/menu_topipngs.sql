-- name: CreateMenuToppings :exec
INSERT INTO menu_toppings (
    menu_id,
    topping_id,
    store_id
)
SELECT
    sqlc.arg(menu_id),
    ids.topping_id,
    sqlc.arg(store_id)
FROM unnest(sqlc.arg(topping_ids)::uuid[]) AS ids(topping_id);