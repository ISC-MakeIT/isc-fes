-- name: GetStoreMembershipApplicationsByStoreID :many
SELECT *
FROM store_membership_applications
WHERE store_id = $1
ORDER BY submitted_at DESC;

-- name: GetStoreMembershipApplicationsByAccountID :many
SELECT *
FROM store_membership_applications
WHERE account_id = $1
ORDER BY submitted_at DESC;