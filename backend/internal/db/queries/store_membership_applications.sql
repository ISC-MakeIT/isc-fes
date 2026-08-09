-- name: GetStoreMembershipApplicationsByStoreID :many
SELECT *
FROM store_membership_applications
WHERE store_id = $1
ORDER BY submitted_at DESC;