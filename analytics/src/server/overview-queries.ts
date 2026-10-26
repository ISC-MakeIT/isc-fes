import type { PoolClient } from "pg";
import {
  intervals,
  type OverviewData,
  type OverviewFilters,
  type OverviewMetrics,
} from "../lib/types";

// One row per time bucket across all stores. Accumulate counts before calculating rates.
const overviewSQL = `WITH
  clock AS (SELECT transaction_timestamp() AS asof),
  bounds AS (SELECT least($2::timestamptz, asof) AS until FROM clock),
  buckets AS (
    SELECT at, greatest(at, $1::timestamptz) AS start,
      least(at + $3::interval, until) AS finish
    FROM bounds CROSS JOIN LATERAL generate_series(
      date_bin($3::interval, $1::timestamptz, '2000-01-01T00:00:00+09:00'::timestamptz),
      date_bin($3::interval, until - interval '1 microsecond', '2000-01-01T00:00:00+09:00'::timestamptz),
      $3::interval) AS at
    WHERE $1::timestamptz < until
  ), cohort AS MATERIALIZED (
    SELECT o.*, o.limit_exempted_by_account_id IS NOT NULL AS is_face,
      ($4 = 'all' OR ($4 = 'completed' AND o.status = 'completed')
        OR ($4 = 'accepted' AND o.status <> 'cancelled')) AS is_sale,
      date_bin($3::interval, o.created_at, '2000-01-01T00:00:00+09:00'::timestamptz) AS bucket
    FROM orders o CROSS JOIN bounds
    WHERE o.created_at >= $1::timestamptz AND o.created_at < until
  ), per_bucket AS (
    SELECT b.start AS "bucketStart", b.finish AS key,
      count(c.id) AS orders,
      count(c.id) FILTER (WHERE c.is_sale) AS "salesOrders",
      count(c.id) FILTER (WHERE c.status = 'completed') AS completed,
      count(c.id) FILTER (WHERE c.status = 'cancelled') AS cancelled,
      count(c.id) FILTER (WHERE c.is_face) AS face,
      COALESCE(sum(c.total_amount) FILTER (WHERE c.is_sale), 0) AS revenue
    FROM buckets b LEFT JOIN cohort c ON c.bucket = b.at
    GROUP BY b.start, b.finish
  ), cumulative AS (
    SELECT "bucketStart", key,
      (sum(orders) OVER w)::int AS orders,
      (sum("salesOrders") OVER w)::int AS "salesOrders",
      (sum(completed) OVER w)::int AS completed,
      (sum(cancelled) OVER w)::int AS cancelled,
      (sum(face) OVER w)::int AS face,
      (sum(revenue) OVER w)::float8 AS revenue
    FROM per_bucket WINDOW w AS (ORDER BY key ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
  ), timeline AS (
    SELECT *, to_char(key AT TIME ZONE 'Asia/Tokyo', 'MM/DD HH24:MI') AS name,
      (100.0 * cancelled / NULLIF(orders, 0))::float8 AS "cancellationRate",
      (100.0 * face / NULLIF(orders, 0))::float8 AS "faceRate"
    FROM cumulative ORDER BY key
  ) SELECT asof, (SELECT COALESCE(json_agg(t ORDER BY t.key), '[]') FROM timeline t) AS timeline FROM clock`;

const empty: OverviewMetrics = {
  revenue: 0,
  orders: 0,
  salesOrders: 0,
  completed: 0,
  cancelled: 0,
  face: 0,
  cancellationRate: null,
  faceRate: null,
};
export async function loadOverview(
  client: PoolClient,
  filters: OverviewFilters,
): Promise<OverviewData> {
  const {
    rows: [row],
  } = await client.query(overviewSQL, [
    filters.start,
    filters.end,
    intervals[filters.interval],
    filters.sales,
  ]);
  const timeline: OverviewData["timeline"] = row.timeline;
  const last = timeline.at(-1);
  const summary: OverviewMetrics = last
    ? {
        revenue: last.revenue,
        orders: last.orders,
        salesOrders: last.salesOrders,
        completed: last.completed,
        cancelled: last.cancelled,
        face: last.face,
        cancellationRate: last.cancellationRate,
        faceRate: last.faceRate,
      }
    : { ...empty };
  return { filters, generatedAt: row.asof.toISOString(), summary, timeline };
}
