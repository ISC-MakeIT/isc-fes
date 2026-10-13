-- psql variables: start_at, end_at (ISO 8601 with timezone).
-- State observations before start_at are needed to carry the last known state into the period.
WITH bounds AS (
    SELECT :'start_at'::timestamptz AS start_at, :'end_at'::timestamptz AS end_at
), observations AS (
    SELECT l.*, metric.name AS metric, metric.state
    FROM activity_log l CROSS JOIN bounds
    CROSS JOIN LATERAL (VALUES
        ('sold_out', l.subject_type IN ('menu','topping') AND
            ((l.payload -> 'after') ? 'sold_out' OR l.event_type IN ('menu.deleted','topping.deleted')),
            (l.payload #>> '{after,sold_out}')::boolean),
        ('order_disabled', l.subject_type = 'store' AND (l.payload -> 'after') ? 'order_enabled',
            NOT (l.payload #>> '{after,order_enabled}')::boolean),
        ('closed', l.subject_type = 'store' AND (l.payload -> 'after') ? 'closed_at',
            (l.payload #> '{after,closed_at}') <> 'null'::jsonb)
    ) AS metric(name, relevant, state)
    WHERE metric.relevant AND l.payload_version = 1 AND l.occurred_at < bounds.end_at
), intervals AS (
    SELECT *, lead(occurred_at) OVER (
        PARTITION BY subject_type, subject_id, metric ORDER BY occurred_at, id
    ) AS next_at FROM observations
), clipped AS (
    SELECT store_id, subject_type, subject_id, metric,
        greatest(occurred_at, bounds.start_at) AS start_at,
        least(COALESCE(next_at, bounds.end_at), bounds.end_at) AS end_at
    FROM intervals CROSS JOIN bounds
    WHERE state IS TRUE AND bounds.start_at < bounds.end_at
)
SELECT store_id, subject_type, subject_id, metric,
    start_at AT TIME ZONE 'Asia/Tokyo' AS start_jst,
    end_at AT TIME ZONE 'Asia/Tokyo' AS end_jst,
    EXTRACT(epoch FROM end_at - start_at) AS duration_seconds
FROM clipped WHERE start_at < end_at
ORDER BY store_id, subject_type, subject_id, metric, start_at;
