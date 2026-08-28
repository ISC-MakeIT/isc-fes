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

-- name: UpdateMenu :one
UPDATE menus
SET
    name = COALESCE(sqlc.narg(name), name),
    description = COALESCE(sqlc.narg(description), description),
    unit_price = COALESCE(sqlc.narg(unit_price), unit_price),
    image_object_key = COALESCE(
        sqlc.narg(image_object_key),
        image_object_key
    ),
    updated_at = now()
WHERE store_id = sqlc.arg(store_id)
  AND id = sqlc.arg(id)
  AND deleted_at IS NULL
RETURNING *;