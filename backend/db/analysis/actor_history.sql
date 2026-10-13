-- psql variables: start_at, end_at, account_id, guest_id. Empty actor IDs disable that filter.
SELECT id, occurred_at AT TIME ZONE 'Asia/Tokyo' AS occurred_jst,
    store_id, event_type, subject_type, subject_id, actor_account_id, actor_guest_id,
    payload_version, payload
FROM activity_log
WHERE occurred_at >= :'start_at'::timestamptz AND occurred_at < :'end_at'::timestamptz
    AND (NULLIF(:'account_id', '')::uuid IS NULL OR actor_account_id = NULLIF(:'account_id', '')::uuid)
    AND (NULLIF(:'guest_id', '')::uuid IS NULL OR actor_guest_id = NULLIF(:'guest_id', '')::uuid)
ORDER BY occurred_at, id;
