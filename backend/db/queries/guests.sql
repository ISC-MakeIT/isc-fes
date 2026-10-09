-- name: CreateGuest :one
INSERT INTO guests DEFAULT VALUES
RETURNING id;

-- name: LockGuest :one
-- 店舗をまたぐ注文数の検証とカート更新をGuest単位で直列化する。
SELECT id FROM guests WHERE id = $1 FOR UPDATE;
