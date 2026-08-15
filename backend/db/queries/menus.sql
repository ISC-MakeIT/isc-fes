-- name: GetMenusByStoreID :many
SELECT *
FROM menus
WHERE store_id = $1
    AND deleted_at IS NULL
ORDER BY created_at ASC, id ASC;

-- name: CreateMenu :one
INSERT INTO menus (
    store_id,
    name,
    description,
    unit_price,
    image_object_key
) VALUES (
    $1, $2, $3, $4, $5
)
RETURNING *;

-- name: AddAllergensToMenu :exec
INSERT INTO menu_allergens (
    menu_id,
    allergen_id
)
SELECT
    sqlc.arg(menu_id),
    ids.allergen_id
FROM unnest(sqlc.arg(allergen_ids)::uuid[]) AS ids(allergen_id)
ON CONFLICT (menu_id, allergen_id) DO NOTHING;