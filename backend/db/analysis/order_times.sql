-- psql variables: start_at, end_at. Existing order timestamps are authoritative,
-- including orders created before activity_log was introduced.
SELECT id AS order_id, store_id, status, display_number,
    created_at AT TIME ZONE 'Asia/Tokyo' AS created_jst,
    (created_at AT TIME ZONE 'Asia/Tokyo')::date AS order_date_jst,
    EXTRACT(epoch FROM ready_at - created_at) AS preparation_seconds,
    EXTRACT(epoch FROM completed_at - ready_at) AS pickup_seconds,
    EXTRACT(epoch FROM completed_at - created_at) AS total_seconds,
    EXTRACT(epoch FROM cancelled_at - ready_at) AS cancellation_wait_seconds
FROM orders
WHERE created_at >= :'start_at'::timestamptz AND created_at < :'end_at'::timestamptz
ORDER BY created_at, id;
