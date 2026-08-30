-- name: GetToppingsByStoreID :many
SELECT *
FROM toppings
WHERE store_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- name: CreateTopping :one
INSERT INTO toppings (
    store_id,
    name,
    unit_price
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: DeleteTopping :execrows
UPDATE toppings
SET deleted_at = NOW()
WHERE id = $1
  AND store_id = $2;