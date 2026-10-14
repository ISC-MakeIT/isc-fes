-- psql variables: start_at, end_at. Baselines are observations, not business operations.
SELECT (occurred_at AT TIME ZONE 'Asia/Tokyo')::date AS date_jst,
    store_id, event_type, actor_account_id, actor_guest_id, count(*) AS event_count
FROM activity_log
WHERE occurred_at >= :'start_at'::timestamptz AND occurred_at < :'end_at'::timestamptz
    AND event_type NOT IN ('store.baseline','menu.baseline','topping.baseline')
GROUP BY date_jst, store_id, event_type, actor_account_id, actor_guest_id
ORDER BY date_jst, store_id, event_type;
