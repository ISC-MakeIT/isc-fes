-- name: GetRooms :many
SELECT *
FROM rooms
ORDER BY sort_order, name;