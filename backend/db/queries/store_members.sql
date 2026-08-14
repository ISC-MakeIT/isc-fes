-- name: GetStoreMemberByAccountIDAndStoreID :one
SELECT *
FROM store_members
WHERE account_id = $1 AND store_id = $2;

-- name: CreateStoreMember :one
INSERT INTO store_members (
    store_id,
    account_id,
    role
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: CreateStoreMemberIfNotExists :one
INSERT INTO store_members (
    store_id,
    account_id,
    role
) VALUES (
    $1, $2, $3
)
ON CONFLICT (store_id, account_id) DO NOTHING
RETURNING *;
