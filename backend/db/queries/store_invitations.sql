-- name: GetStoreInvitationByID :one
SELECT *
FROM store_invitations
WHERE id = $1;

-- name: CreateStoreInvitation :one
INSERT INTO store_invitations (
    store_id,
    role,
    max_uses
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: IncrementStoreInvitationUseCount :one
UPDATE store_invitations
SET
    use_count = use_count + 1,
    updated_at = now()
WHERE id = $1
  AND (
      max_uses IS NULL -- max_uses が NULL の場合は無制限に使用可能
      OR use_count < max_uses
  )
RETURNING *;
