-- name: GetAccountForStoreApplication :one
SELECT id, store_id
FROM accounts
WHERE id = $1
FOR UPDATE;

-- name: CreateStore :one
INSERT INTO stores (
    id,
    name,
    room,
    description,
    image_object_key,
    review_status
) VALUES (
    $1, $2, $3, $4, $5, 'pending'
)
RETURNING *;

-- name: AssignStoreToAccount :exec
UPDATE accounts
SET
    store_id = $2,
    updated_at = now()
WHERE id = $1;