-- name: InsertActivityLog :exec
INSERT INTO activity_log (
    occurred_at, event_type, store_id, subject_type, subject_id,
    actor_account_id, actor_guest_id, payload_version, payload
) VALUES (
    COALESCE(sqlc.narg(occurred_at)::timestamptz, clock_timestamp()),
    sqlc.arg(event_type), sqlc.arg(store_id), sqlc.arg(subject_type), sqlc.arg(subject_id),
    sqlc.narg(actor_account_id), sqlc.narg(actor_guest_id), 1, sqlc.arg(payload)
);

-- name: GetActivityMenuToppingIDs :many
SELECT topping_id FROM menu_toppings
WHERE store_id = sqlc.arg(store_id) AND menu_id = sqlc.arg(menu_id)
ORDER BY topping_id;

-- name: GetActivityStoreAllergenIDs :many
SELECT allergen_id FROM store_allergens WHERE store_id = $1 ORDER BY allergen_id;

-- name: GetActivityMenusByTopping :many
SELECT menus.* FROM menus
JOIN menu_toppings ON menu_toppings.menu_id = menus.id AND menu_toppings.store_id = menus.store_id
WHERE menu_toppings.store_id = sqlc.arg(store_id) AND menu_toppings.topping_id = sqlc.arg(topping_id)
ORDER BY menus.id;
