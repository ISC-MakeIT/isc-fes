-- name: GetRooms :many
SELECT *
FROM rooms
ORDER BY sort_order, name;

-- name: GetRoomByName :one
SELECT *
FROM rooms
WHERE name = $1;