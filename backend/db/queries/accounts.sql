-- name: UpsertAccount :one
INSERT INTO accounts (
    google_sub,
    email,
    display_name,
    picture_url
)
VALUES (
    sqlc.arg(google_sub),
    sqlc.arg(email),
    sqlc.arg(display_name),
    sqlc.narg(picture_url)
)
ON CONFLICT (google_sub)
DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    picture_url = EXCLUDED.picture_url,
    last_login_at = now(),
    updated_at = now()
RETURNING *;

-- name: GetAccountByID :one
SELECT *
FROM accounts
WHERE id = sqlc.arg(id);
