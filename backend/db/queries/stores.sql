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

-- name: GetApprovedStores :many
SELECT *
FROM stores
WHERE review_status = 'approved'
ORDER BY created_at DESC;

-- name: GetApprovedStoreByID :one
SELECT *
FROM stores
WHERE review_status = 'approved'
    AND id = $1;

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
WHERE review_status = 'pending'
ORDER BY created_at DESC;

-- name: GetStoreByID :one
SELECT *
FROM stores
WHERE id = $1;

-- name: UpdateStoreClosed :one
UPDATE stores
SET
    closed_at = CASE
        WHEN sqlc.arg(closed)::boolean THEN COALESCE(closed_at, now())
        ELSE NULL
    END,
    updated_at = CASE
        WHEN (sqlc.arg(closed)::boolean AND closed_at IS NULL)
          OR (NOT sqlc.arg(closed)::boolean AND closed_at IS NOT NULL)
        THEN now()
        ELSE updated_at
    END
WHERE id = sqlc.arg(store_id)
    AND review_status = 'approved'
RETURNING *;

-- name: UpdateStoreReviewStatusById :exec
UPDATE stores
SET
    review_status = $2,
    updated_at = now()
WHERE id = $1
    AND review_status = 'pending'; -- pending からしか遷移できないので pending の場合のみ更新する

-- name: AddAllergensToStore :exec
INSERT INTO store_allergens (
    store_id,
    allergen_id
)
SELECT
    sqlc.arg(store_id),
    ids.allergen_id
FROM unnest(sqlc.arg(allergen_ids)::uuid[]) AS ids(allergen_id)
ON CONFLICT (store_id, allergen_id) DO NOTHING;
