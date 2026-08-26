-- name: GetStoreMembershipByAccountIDAndStoreID :one
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

-- name: GetStoreMembersByStoreID :many
SELECT *
FROM store_members
INNER JOIN accounts
    ON store_members.account_id = accounts.id
WHERE store_members.store_id = $1
ORDER BY store_members.joined_at ASC;

-- name: RemoveStoreMemberByAccountIDAndStoreID :exec
DELETE FROM store_members
WHERE account_id = $1 AND store_id = $2;
