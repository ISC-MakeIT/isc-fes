import type { PoolClient } from "pg";
import { InputError } from "../lib/filters";
import {
  intervals,
  type AnalyticsData,
  type Filters,
  type Metadata,
  type StoreFilters,
} from "../lib/types";

export async function loadMetadata(client: PoolClient): Promise<Metadata> {
  const {
    rows: [row],
  } = await client.query(`SELECT
    COALESCE((SELECT json_agg(s ORDER BY s.name) FROM (SELECT id, name FROM stores) s), '[]') AS stores,
    COALESCE((SELECT json_agg(m ORDER BY m.name) FROM (SELECT id, name, store_id AS "storeId" FROM menus) m), '[]') AS menus,
    (SELECT min(created_at) FROM orders) AS "firstOrder",
    (SELECT max(created_at) FROM orders) AS "lastOrder",
    (SELECT min(created_at) FROM guests) AS "firstGuest",
    (SELECT max(created_at) FROM guests) AS "lastGuest",
    (SELECT min(created_at) FROM reviews) AS "firstReview",
    (SELECT max(created_at) FROM reviews) AS "lastReview",
    COALESCE((SELECT json_agg(t.trigger ORDER BY t.trigger) FROM (SELECT DISTINCT NULLIF(btrim(trigger),'') AS trigger FROM reviews) t WHERE t.trigger IS NOT NULL), '[]') AS "reviewTriggers",
    to_regclass('activity_log') IS NOT NULL AS "hasActivityLog"`);
  return row;
}

// All substitutions below are fixed SQL fragments. User values only enter through $n parameters.
const salesCondition = `($7 = 'all' OR ($7 = 'completed' AND c.status = 'completed') OR ($7 = 'accepted' AND c.status <> 'cancelled'))`;
const metrics = `
  count(c.id)::int AS orders,
  count(c.id) FILTER (WHERE c.status = 'pending')::int AS pending,
  count(c.id) FILTER (WHERE c.status = 'ready')::int AS ready,
  count(c.id) FILTER (WHERE c.status = 'completed')::int AS completed,
  count(c.id) FILTER (WHERE c.status = 'cancelled')::int AS cancelled,
  count(c.id) FILTER (WHERE c.is_face)::int AS face,
  count(DISTINCT c.guest_id)::int AS guests,
  COALESCE(sum(c.revenue) FILTER (WHERE ${salesCondition}), 0)::float8 AS revenue,
  COALESCE(sum(c.units) FILTER (WHERE ${salesCondition}), 0)::int AS units,
  count(c.id) FILTER (WHERE ${salesCondition})::int AS "salesOrders",
  (100.0 * count(c.id) FILTER (WHERE c.status = 'cancelled') / NULLIF(count(c.id), 0))::float8 AS "cancellationRate",
  (100.0 * count(c.id) FILTER (WHERE c.is_face) / NULLIF(count(c.id), 0))::float8 AS "faceRate",
  (sum(c.revenue) FILTER (WHERE ${salesCondition}) / NULLIF(count(c.id) FILTER (WHERE ${salesCondition}), 0))::float8 AS "averageAmount",
  percentile_cont(0.5) WITHIN GROUP (ORDER BY c.revenue) FILTER (WHERE ${salesCondition})::float8 AS "medianAmount",
  avg(c.total_minutes)::float8 AS "averageMinutes",
  percentile_cont(0.5) WITHIN GROUP (ORDER BY c.total_minutes)::float8 AS "medianMinutes",
  percentile_cont(0.9) WITHIN GROUP (ORDER BY c.total_minutes)::float8 AS "p90Minutes",
  avg(c.preparation_minutes)::float8 AS "preparationMinutes",
  percentile_cont(0.5) WITHIN GROUP (ORDER BY c.preparation_minutes)::float8 AS "preparationMedianMinutes",
  percentile_cont(0.9) WITHIN GROUP (ORDER BY c.preparation_minutes)::float8 AS "preparationP90Minutes",
  count(c.preparation_minutes)::int AS "preparationSamples",
  avg(c.pickup_minutes)::float8 AS "pickupMinutes",
  percentile_cont(0.5) WITHIN GROUP (ORDER BY c.pickup_minutes)::float8 AS "pickupMedianMinutes",
  percentile_cont(0.9) WITHIN GROUP (ORDER BY c.pickup_minutes)::float8 AS "pickupP90Minutes",
  count(c.pickup_minutes)::int AS "pickupSamples",
  avg(c.cancellation_wait_minutes)::float8 AS "cancellationWaitMinutes",
  percentile_cont(0.5) WITHIN GROUP (ORDER BY c.cancellation_wait_minutes)::float8 AS "cancellationWaitMedianMinutes",
  avg(c.cancellation_minutes)::float8 AS "cancellationMinutes",
  percentile_cont(0.5) WITHIN GROUP (ORDER BY c.cancellation_minutes)::float8 AS "cancellationMedianMinutes"`;

export const analyticsSQL = `WITH
  topping_prices AS (
    SELECT order_item_id, sum(unit_price) AS price FROM order_item_toppings GROUP BY order_item_id
  ), item_totals AS (
    SELECT i.order_id, sum((i.unit_price + COALESCE(t.price, 0)) * i.quantity) AS revenue, sum(i.quantity) AS units
    FROM order_items i LEFT JOIN topping_prices t ON t.order_item_id = i.id
    WHERE ($4::uuid IS NULL OR i.menu_id = $4)
    GROUP BY i.order_id
  ), cohort AS MATERIALIZED (
    SELECT o.*, s.name AS current_store_name, o.limit_exempted_by_account_id IS NOT NULL AS is_face,
      CASE WHEN $4::uuid IS NULL THEN o.total_amount ELSE it.revenue END::numeric AS revenue,
      it.units,
      date_bin($8::interval, o.created_at, '2000-01-01T00:00:00+09:00'::timestamptz) AS bucket,
      extract(epoch FROM o.completed_at - o.created_at) / 60.0 AS total_minutes,
      extract(epoch FROM o.ready_at - o.created_at) / 60.0 AS preparation_minutes,
      extract(epoch FROM o.completed_at - o.ready_at) / 60.0 AS pickup_minutes,
      extract(epoch FROM o.cancelled_at - o.created_at) / 60.0 AS cancellation_minutes,
      extract(epoch FROM o.cancelled_at - o.ready_at) / 60.0 AS cancellation_wait_minutes
    FROM orders o JOIN stores s ON s.id = o.store_id JOIN item_totals it ON it.order_id = o.id
    WHERE o.created_at >= $1::timestamptz AND o.created_at < $2::timestamptz
      AND ($3::uuid IS NULL OR o.store_id = $3)
      AND ($9::uuid[] IS NULL OR o.store_id = ANY($9))
      AND ($5 = 'all' OR o.status::text = $5)
      AND ($6 = 'all' OR ($6 = 'face' AND o.limit_exempted_by_account_id IS NOT NULL)
        OR ($6 = 'mobile' AND o.limit_exempted_by_account_id IS NULL))
  ), buckets AS (
    SELECT generate_series(date_bin($8::interval, $1::timestamptz, '2000-01-01T00:00:00+09:00'::timestamptz),
      date_bin($8::interval, $2::timestamptz - interval '1 microsecond', '2000-01-01T00:00:00+09:00'::timestamptz), $8::interval) AS at
  ), summary AS (SELECT ${metrics} FROM cohort c),
  timeline AS (SELECT b.at AS key, to_char(b.at AT TIME ZONE 'Asia/Tokyo', 'MM/DD HH24:MI') AS name, ${metrics}
    FROM buckets b LEFT JOIN cohort c ON c.bucket = b.at GROUP BY b.at ORDER BY b.at),
  store_metrics AS (SELECT s.id AS key, s.name, ${metrics}
    FROM stores s LEFT JOIN cohort c ON c.store_id = s.id
    WHERE ($3::uuid IS NULL OR s.id = $3) AND ($9::uuid[] IS NULL OR s.id = ANY($9))
    GROUP BY s.id, s.name ORDER BY revenue DESC, orders DESC, s.id),
  menu_cohort AS (
    SELECT c.*, i.menu_id, i.menu_name, i.quantity AS menu_units,
      (i.unit_price + COALESCE(t.price, 0)) * i.quantity AS menu_revenue
    FROM cohort c JOIN order_items i ON i.order_id = c.id LEFT JOIN topping_prices t ON t.order_item_id = i.id
    WHERE ($4::uuid IS NULL OR i.menu_id = $4)
  ), menu_orders AS (
    SELECT menu_id, store_id, current_store_name, id, guest_id, status, is_face,
      bucket, total_minutes, preparation_minutes, pickup_minutes, cancellation_wait_minutes, cancellation_minutes,
      sum(menu_units) AS units, sum(menu_revenue)::numeric AS revenue
    FROM menu_cohort GROUP BY menu_id, store_id, current_store_name, id, guest_id, status, is_face,
      bucket, total_minutes, preparation_minutes, pickup_minutes, cancellation_wait_minutes, cancellation_minutes
  ), menu_names AS (
    SELECT DISTINCT ON (menu_id) menu_id, menu_name FROM menu_cohort ORDER BY menu_id, created_at DESC, id DESC
  ), menu_metrics AS (SELECT c.menu_id AS key, n.menu_name || ' / ' || c.current_store_name AS name, ${metrics}
    FROM menu_orders c JOIN menu_names n ON n.menu_id = c.menu_id
    GROUP BY c.menu_id, n.menu_name, c.current_store_name ORDER BY revenue DESC, orders DESC, c.menu_id),
  menu_timeline AS (SELECT b.at AS key, c.menu_id AS "menuId", n.menu_name || ' / ' || c.current_store_name AS name, ${metrics}
    FROM menu_orders c JOIN menu_names n ON n.menu_id = c.menu_id
    JOIN buckets b ON c.bucket = b.at OR ($10::boolean AND c.bucket < b.at)
    GROUP BY b.at, c.menu_id, n.menu_name, c.current_store_name ORDER BY b.at, c.menu_id),
  status_metrics AS (SELECT c.status::text AS key, c.status::text AS name, ${metrics} FROM cohort c GROUP BY c.status),
  channel_metrics AS (SELECT CASE WHEN c.is_face THEN 'face' ELSE 'mobile' END AS key,
    CASE WHEN c.is_face THEN '対面受付（推定）' ELSE 'モバイル' END AS name, ${metrics} FROM cohort c GROUP BY c.is_face),
  hour_metrics AS (SELECT h.hour::text AS key, lpad(h.hour::text, 2, '0') || ':00' AS name, ${metrics}
    FROM generate_series(0, 23) AS h(hour) LEFT JOIN cohort c ON extract(hour FROM c.created_at AT TIME ZONE 'Asia/Tokyo') = h.hour
    GROUP BY h.hour ORDER BY h.hour),
  weekday_metrics AS (SELECT d.day::text AS key, (ARRAY['日','月','火','水','木','金','土'])[d.day + 1] AS name, ${metrics}
    FROM generate_series(0, 6) AS d(day) LEFT JOIN cohort c ON extract(dow FROM c.created_at AT TIME ZONE 'Asia/Tokyo') = d.day
    GROUP BY d.day ORDER BY d.day),
  store_timeline AS (SELECT b.at AS key, c.store_id AS "storeId", c.current_store_name AS name, ${metrics}
    FROM cohort c JOIN buckets b ON c.bucket = b.at OR ($10::boolean AND c.bucket < b.at)
    GROUP BY b.at, c.store_id, c.current_store_name ORDER BY b.at, c.store_id),
  duration_ranges AS (SELECT * FROM (VALUES (0, 0, 5, '5分未満'), (1, 5, 10, '5–10分'), (2, 10, 15, '10–15分'),
    (3, 15, 30, '15–30分'), (4, 30, 60, '30–60分'), (5, 60, 1e20, '60分以上')) AS r(position, lower, upper, name)),
  durations AS (SELECT r.name, count(c.id)::int AS orders FROM duration_ranges r LEFT JOIN cohort c
    ON c.total_minutes >= r.lower AND c.total_minutes < r.upper GROUP BY r.position, r.name ORDER BY r.position)
  SELECT (SELECT row_to_json(s) FROM summary s) AS summary,
    (SELECT COALESCE(json_agg(t), '[]') FROM timeline t) AS timeline,
    (SELECT COALESCE(json_agg(s), '[]') FROM store_metrics s) AS stores,
    (SELECT COALESCE(json_agg(m), '[]') FROM menu_metrics m) AS menus,
    (SELECT COALESCE(json_agg(s), '[]') FROM status_metrics s) AS statuses,
    (SELECT COALESCE(json_agg(c), '[]') FROM channel_metrics c) AS channels,
    (SELECT COALESCE(json_agg(h), '[]') FROM hour_metrics h) AS hours,
    (SELECT COALESCE(json_agg(w), '[]') FROM weekday_metrics w) AS weekdays,
    (SELECT COALESCE(json_agg(s), '[]') FROM store_timeline s) AS "storeTimeline",
    (SELECT COALESCE(json_agg(m), '[]') FROM menu_timeline m) AS "menuTimeline",
    (SELECT COALESCE(json_agg(d), '[]') FROM durations d) AS durations`;

function congestionSQL(hasActivity: boolean) {
  const observed = hasActivity
    ? `LEFT JOIN LATERAL (
    SELECT CASE WHEN count(DISTINCT (l.payload #>> '{after,congestion_level}')) = 1
      THEN min((l.payload #>> '{after,congestion_level}')::int) END AS reported
    FROM activity_log l WHERE l.store_id = s.id AND l.subject_type = 'store' AND l.payload_version = 1
      AND (l.payload -> 'after') ? 'congestion_level' AND l.occurred_at <= b.sample
    GROUP BY l.occurred_at ORDER BY l.occurred_at DESC LIMIT 1
  ) observation ON true`
    : "LEFT JOIN LATERAL (SELECT NULL::int AS reported) observation ON true";
  return `WITH buckets AS (
    SELECT at, greatest(at, $1::timestamptz) AS start_at,
      least(at + $4::interval, $2::timestamptz) - interval '1 microsecond' AS sample
    FROM generate_series(date_bin($4::interval, $1::timestamptz, '2000-01-01T00:00:00+09:00'::timestamptz),
      date_bin($4::interval, $2::timestamptz - interval '1 microsecond', '2000-01-01T00:00:00+09:00'::timestamptz), $4::interval) AS at
  ), samples AS (
    SELECT b.at, s.id AS "storeId", s.name AS "storeName", observation.reported,
      counts.preparing, counts.active, counts.arrivals
    FROM buckets b CROSS JOIN stores s
    LEFT JOIN LATERAL (
      SELECT count(*) FILTER (WHERE o.created_at <= b.sample AND (o.ready_at IS NULL OR o.ready_at > b.sample))::int AS preparing,
        count(*) FILTER (WHERE o.created_at <= b.sample AND (COALESCE(o.completed_at, o.cancelled_at) IS NULL OR COALESCE(o.completed_at, o.cancelled_at) > b.sample))::int AS active,
        count(*) FILTER (WHERE o.created_at >= b.start_at AND o.created_at <= b.sample)::int AS arrivals
      FROM orders o WHERE o.store_id = s.id AND o.created_at <= b.sample
        AND (o.created_at >= b.start_at OR COALESCE(o.completed_at, o.cancelled_at, 'infinity'::timestamptz) > b.sample)
    ) counts ON true
    ${observed}
    WHERE ($3::uuid IS NULL OR s.id = $3) AND ($8::uuid[] IS NULL OR s.id = ANY($8)) AND s.created_at <= b.sample
  ), inferred AS (
    SELECT *, CASE WHEN (CASE $5 WHEN 'preparing' THEN preparing WHEN 'active' THEN active ELSE arrivals END) < $6 THEN 1
      WHEN (CASE $5 WHEN 'preparing' THEN preparing WHEN 'active' THEN active ELSE arrivals END) < $7 THEN 2 ELSE 3 END AS inferred FROM samples
  ) SELECT *, inferred - reported AS gap FROM inferred ORDER BY at, "storeId"`;
}

export async function loadAnalytics(
  client: PoolClient,
  filters: Filters & Partial<Pick<StoreFilters, "storeIds" | "accumulation">>,
  options: { includeCongestion?: boolean } = {},
): Promise<AnalyticsData> {
  const {
    rows: [metadata],
  } = await client.query(
    "SELECT transaction_timestamp() AS asof, to_regclass('activity_log') IS NOT NULL AS activity, (SELECT count(*)::int FROM stores WHERE ($1::uuid IS NULL OR id = $1) AND ($2::uuid[] IS NULL OR id = ANY($2))) AS stores",
    [filters.store || null, filters.storeIds?.length ? filters.storeIds : null],
  );
  const bucketCount =
    Math.ceil(
      (Date.parse(filters.end) - Date.parse(filters.start)) /
        { "5m": 300000, "15m": 900000, "30m": 1800000, "1h": 3600000, "1d": 86400000 }[
          filters.interval
        ],
    ) + 1;
  if (bucketCount * metadata.stores > 20000)
    throw new InputError(
      "店舗×集計区間が20,000点を超えます。店舗を絞るか、集計単位を大きくしてください。",
    );
  const {
    rows: [data],
  } = await client.query(analyticsSQL, [
    filters.start,
    filters.end,
    filters.store || null,
    filters.menu || null,
    filters.status,
    filters.channel,
    filters.sales,
    intervals[filters.interval],
    filters.storeIds?.length ? filters.storeIds : null,
    filters.accumulation === "cumulative",
  ]);
  // Unresolved orders must not be projected into future congestion samples.
  const congestionEnd = new Date(
    Math.min(Date.parse(filters.end), metadata.asof.getTime()),
  ).toISOString();
  const congestion =
    options.includeCongestion === false || Date.parse(filters.start) >= Date.parse(congestionEnd)
      ? []
      : (
          await client.query(congestionSQL(metadata.activity), [
            filters.start,
            congestionEnd,
            filters.store || null,
            intervals[filters.interval],
            filters.congestionMetric,
            filters.low,
            filters.high,
            filters.storeIds?.length ? filters.storeIds : null,
          ])
        ).rows;
  return {
    ...data,
    filters,
    congestion,
    hasActivityLog: metadata.activity,
    generatedAt: metadata.asof.toISOString(),
  };
}
