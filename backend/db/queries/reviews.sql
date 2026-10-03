-- name: CreateReview :one
INSERT INTO reviews (guest_id, account_id, rating, comment, trigger)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;
