-- name: CreateGuest :one
INSERT INTO guests DEFAULT VALUES
RETURNING id;
