-- name: GetMenusByStoreID :many
SELECT *
FROM menus
WHERE store_id = $1
    AND deleted_at IS NULL
ORDER BY created_at ASC, id ASC;

-- name: GetMenuByStoreIDAndMenuID :one
SELECT *
FROM menus
WHERE store_id = $1
    AND id = $2
    AND deleted_at IS NULL;

-- name: CreateMenu :one
INSERT INTO menus (
    id,
    store_id,
    name,
    description,
    unit_price,
    image_object_key
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING *;

