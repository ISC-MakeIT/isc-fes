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

-- name: CreateStoreMember :one
INSERT INTO store_members (
    store_id,
    account_id,
    role
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: GetApprovedStores :many
SELECT *
FROM stores
WHERE review_status = 'approved'
ORDER BY created_at DESC;

-- name: GetVisibleStoresByAccountID :many
SELECT *
FROM stores
WHERE review_status = 'approved'
   OR id IN (
       SELECT store_id
       FROM store_members
       WHERE account_id = $1
         AND role = 'manager'
   )
ORDER BY created_at DESC;

-- name: GetStoreApplications :many
SELECT *
FROM stores
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
