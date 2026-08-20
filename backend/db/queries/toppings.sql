-- name: GetToppingsByStoreID :many
SELECT *
FROM toppings
WHERE store_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC;