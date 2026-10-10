-- name: FindOrderForCartVersion :one
-- Guestロックの後、現在の販売状況を検証する前に再送を解決する。
SELECT orders.* FROM orders
JOIN carts ON carts.id = orders.origin_cart_id
WHERE carts.guest_id = sqlc.arg(guest_id)
  AND carts.store_id = sqlc.arg(store_id)
  AND orders.origin_cart_version = sqlc.arg(cart_version);

-- name: LockOrderCart :one
SELECT * FROM carts
WHERE guest_id = sqlc.arg(guest_id) AND store_id = sqlc.arg(store_id)
FOR UPDATE;

-- name: LockOrderMembership :one
SELECT * FROM store_members
WHERE store_id = sqlc.arg(store_id) AND account_id = sqlc.arg(account_id)
FOR UPDATE;

-- name: CountActiveNonExemptOrders :one
SELECT count(*) FROM orders
WHERE guest_id = $1 AND status IN ('pending', 'ready')
  AND limit_exempted_by_account_id IS NULL;

-- name: NextOrderDisplayNumber :one
INSERT INTO store_order_counters (store_id, last_number) VALUES ($1, 1)
ON CONFLICT (store_id) DO UPDATE
SET last_number = store_order_counters.last_number + 1
RETURNING last_number;

-- name: CreateOrder :one
INSERT INTO orders (
    store_id, guest_id, total_amount, display_number,
    origin_cart_id, origin_cart_version, limit_exempted_by_account_id,
    store_name, room_name
) VALUES (
    sqlc.arg(store_id), sqlc.arg(guest_id), sqlc.arg(total_amount), sqlc.arg(display_number),
    sqlc.arg(origin_cart_id), sqlc.arg(origin_cart_version), sqlc.narg(limit_exempted_by_account_id),
    sqlc.arg(store_name), sqlc.arg(room_name)
) RETURNING *;

-- name: CreateOrderItem :one
INSERT INTO order_items (order_id, store_id, menu_id, menu_name, unit_price, quantity)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;

-- name: CreateOrderItemTopping :exec
INSERT INTO order_item_toppings (order_item_id, store_id, topping_id, topping_name, unit_price)
VALUES ($1, $2, $3, $4, $5);

-- name: GetCreatedOrderItems :many
SELECT * FROM order_items WHERE order_id = $1 ORDER BY id;

-- name: GetCreatedOrderItemToppings :many
SELECT order_item_toppings.* FROM order_item_toppings
JOIN order_items ON order_items.id = order_item_toppings.order_item_id
WHERE order_items.order_id = $1 ORDER BY order_item_id, topping_id;

-- name: GetOrdersByGuestID :many
SELECT * FROM orders
WHERE guest_id = sqlc.arg(guest_id)
  AND (
    cardinality(sqlc.arg(statuses)::text[]) = 0
    OR status = ANY(sqlc.arg(statuses)::text[]::order_status[])
  )
ORDER BY created_at DESC, id DESC;

-- name: GetOrdersByStoreID :many
SELECT * FROM orders
WHERE store_id = sqlc.arg(store_id)
  AND status = ANY(sqlc.arg(statuses)::text[]::order_status[])
ORDER BY created_at ASC, id ASC;

-- name: GetOrderByIDAndGuestID :one
SELECT * FROM orders
WHERE id = sqlc.arg(order_id) AND guest_id = sqlc.arg(guest_id);

-- name: LockOrderByIDAndStoreID :one
SELECT * FROM orders
WHERE id = sqlc.arg(order_id) AND store_id = sqlc.arg(store_id)
FOR UPDATE;

-- name: GetOrderUpdateTime :one
-- now()は取引開始時刻なので、ロック待機後の状態遷移の判定には使わない。
SELECT clock_timestamp()::timestamptz AS at;

-- name: UpdateOrderStatus :one
UPDATE orders
SET status = sqlc.arg(status), version = version + 1,
    ready_at = sqlc.narg(ready_at), completed_at = sqlc.narg(completed_at),
    cancelled_at = sqlc.narg(cancelled_at), updated_at = sqlc.arg(updated_at)
WHERE id = sqlc.arg(order_id) AND store_id = sqlc.arg(store_id)
    AND version = sqlc.arg(expected_version)
RETURNING *;

-- name: GetOrderItemsByOrderIDs :many
SELECT * FROM order_items
WHERE order_id = ANY(sqlc.arg(order_ids)::uuid[])
ORDER BY order_id, id;

-- name: GetOrderItemToppingsByOrderIDs :many
SELECT order_item_toppings.* FROM order_item_toppings
JOIN order_items ON order_items.id = order_item_toppings.order_item_id
WHERE order_items.order_id = ANY(sqlc.arg(order_ids)::uuid[])
ORDER BY order_item_id, topping_id;
