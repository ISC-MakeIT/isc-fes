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

-- name: GetApprovedStores :many
SELECT *
FROM stores
WHERE review_status = 'approved'
ORDER BY created_at DESC;

-- name: GetStoreByID :one
SELECT *
FROM stores
WHERE id = $1;

-- name: UpdateStoreReviewStatusById :exec
UPDATE stores
SET
    review_status = $2,
    updated_at = now()
WHERE id = $1
    AND review_status = 'pending'; -- pending からしか遷移できないので pending の場合のみ更新する