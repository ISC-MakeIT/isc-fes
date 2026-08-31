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
  AND store_id = $2
  AND deleted_at IS NULL;

-- name: UpdateToppingByToppingIDAndStoreID :one
UPDATE toppings
SET
  name = sqlc.arg(name),
  unit_price = sqlc.arg(unit_price), 
  sold_out = sqlc.arg(sold_out),
  updated_at = NOW()
WHERE id = sqlc.arg(topping_id)
  AND store_id = sqlc.arg(store_id)
  AND deleted_at IS NULL
RETURNING *;