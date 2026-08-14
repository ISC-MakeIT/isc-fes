-- name: GetStoreMemberByAccountIDAndStoreID :one
SELECT *
FROM store_members
WHERE account_id = $1 AND store_id = $2;