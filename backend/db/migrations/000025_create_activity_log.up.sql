BEGIN;

CREATE TABLE activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at timestamptz NOT NULL,
    event_type text NOT NULL CHECK (event_type <> ''),
    store_id uuid NOT NULL,
    subject_type text NOT NULL CHECK (subject_type IN ('order', 'menu', 'topping', 'store')),
    subject_id uuid NOT NULL,
    actor_account_id uuid,
    actor_guest_id uuid,
    payload_version smallint NOT NULL DEFAULT 1 CHECK (payload_version > 0),
    payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    CHECK (split_part(event_type, '.', 1) = subject_type),
    CHECK (
        (event_type IN ('store.baseline', 'menu.baseline', 'topping.baseline')
            AND actor_account_id IS NULL AND actor_guest_id IS NULL)
        OR (event_type NOT IN ('store.baseline', 'menu.baseline', 'topping.baseline')
            AND (actor_account_id IS NOT NULL OR actor_guest_id IS NOT NULL))
    )
);

CREATE INDEX activity_log_store_time_idx ON activity_log (store_id, occurred_at, id);
CREATE INDEX activity_log_subject_time_idx ON activity_log (subject_type, subject_id, occurred_at, id);
CREATE INDEX activity_log_event_time_idx ON activity_log (event_type, occurred_at);

-- baselineの読み取り中は対象と関連の変更を止める。導入時は旧バックエンドの書き込みも停止する。
LOCK TABLE stores, menus, toppings, menu_toppings, store_allergens IN SHARE ROW EXCLUSIVE MODE;

WITH captured AS MATERIALIZED (SELECT clock_timestamp() AS at), snapshots AS (
    SELECT 'store'::text AS subject_type, s.id AS subject_id, s.id AS store_id,
        jsonb_build_object(
            'name', s.name, 'room', s.room, 'description', s.description,
            'image_object_key', s.image_object_key, 'review_status', s.review_status,
            'order_enabled', s.order_enabled, 'closed_at', s.closed_at,
            'congestion_level', s.congestion_level,
            'allergen_ids', COALESCE((SELECT jsonb_agg(a.allergen_id ORDER BY a.allergen_id)
                FROM store_allergens a WHERE a.store_id = s.id), '[]'::jsonb)
        ) AS snapshot
    FROM stores s
    UNION ALL
    SELECT 'menu', m.id, m.store_id,
        jsonb_build_object(
            'name', m.name, 'description', m.description, 'unit_price', m.unit_price,
            'image_object_key', m.image_object_key, 'sold_out', m.sold_out,
            'topping_ids', COALESCE((SELECT jsonb_agg(t.topping_id ORDER BY t.topping_id)
                FROM menu_toppings t WHERE t.store_id = m.store_id AND t.menu_id = m.id), '[]'::jsonb)
        )
    FROM menus m WHERE m.deleted_at IS NULL
    UNION ALL
    SELECT 'topping', t.id, t.store_id,
        jsonb_build_object('name', t.name, 'unit_price', t.unit_price, 'sold_out', t.sold_out)
    FROM toppings t WHERE t.deleted_at IS NULL
)
INSERT INTO activity_log (occurred_at, event_type, store_id, subject_type, subject_id, payload)
SELECT captured.at, snapshots.subject_type || '.baseline', snapshots.store_id,
    snapshots.subject_type, snapshots.subject_id,
    jsonb_build_object('before', NULL, 'after', snapshots.snapshot)
FROM snapshots CROSS JOIN captured;

COMMIT;
