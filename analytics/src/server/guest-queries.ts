import type { PoolClient } from "pg";
import { intervals, type GuestData, type GuestFilters } from "../lib/types";

function guestSQL(hasActivity: boolean) {
  const actorObservations = hasActivity
    ? `UNION
    SELECT l.actor_guest_id AS guest_id, l.occurred_at AS at
    FROM activity_log l JOIN scope_orders o ON l.subject_type = 'order' AND l.subject_id = o.id AND l.actor_guest_id = o.guest_id
    JOIN population p ON p.id = o.guest_id CROSS JOIN bounds b
    WHERE l.payload_version = 1 AND l.occurred_at >= b.start_at AND l.occurred_at < b.end_at`
    : "";
  return `WITH bounds AS (
    SELECT $1::timestamptz AS start_at, least($2::timestamptz, transaction_timestamp()) AS end_at
  ), buckets AS (
    SELECT generate_series(date_bin($3::interval, $1::timestamptz, '2000-01-01T00:00:00+09:00'::timestamptz),
      date_bin($3::interval, $2::timestamptz - interval '1 microsecond', '2000-01-01T00:00:00+09:00'::timestamptz), $3::interval) AS at
  ), scope_orders AS MATERIALIZED (
    SELECT o.* FROM orders o CROSS JOIN bounds b
    WHERE o.created_at >= b.start_at AND o.created_at < b.end_at
      AND ($4 = 'all' OR ($4 = 'mobile' AND o.limit_exempted_by_account_id IS NULL) OR ($4 = 'face' AND o.limit_exempted_by_account_id IS NOT NULL))
  ), population AS MATERIALIZED (
    SELECT DISTINCT guest_id AS id FROM scope_orders WHERE $5 = 'purchasers' AND status = 'completed'
    UNION
    SELECT g.id FROM guests g CROSS JOIN bounds b WHERE $5 = 'registered' AND g.created_at >= b.start_at AND g.created_at < b.end_at
  ), guest_totals AS (
    SELECT p.id, COALESCE(sum(o.total_amount) FILTER (WHERE o.status = 'completed'), 0)::numeric AS spending,
      count(o.id)::int AS orders, count(DISTINCT o.store_id)::int AS stores,
      count(o.id) FILTER (WHERE o.status = 'completed')::int AS purchases
    FROM population p LEFT JOIN scope_orders o ON o.guest_id = p.id GROUP BY p.id
  ), observations AS (
    SELECT o.guest_id, v.at FROM scope_orders o JOIN population p ON p.id = o.guest_id CROSS JOIN bounds b
    CROSS JOIN LATERAL (VALUES (o.created_at), (o.completed_at), (o.cancelled_at)) v(at)
    WHERE v.at >= b.start_at AND v.at < b.end_at
    ${actorObservations}
  ), daily_observations AS (
    SELECT guest_id, (at AT TIME ZONE 'Asia/Tokyo')::date AS day,
      min(at) AS first_at, max(at) AS last_at, count(DISTINCT at)::int AS points
    FROM observations GROUP BY guest_id, (at AT TIME ZONE 'Asia/Tokyo')::date
  ), daily_open AS (
    SELECT o.guest_id, (o.created_at AT TIME ZONE 'Asia/Tokyo')::date AS day,
      bool_or(COALESCE(o.completed_at, o.cancelled_at) IS NULL OR COALESCE(o.completed_at, o.cancelled_at) >= b.end_at
        OR (COALESCE(o.completed_at, o.cancelled_at) AT TIME ZONE 'Asia/Tokyo')::date > (o.created_at AT TIME ZONE 'Asia/Tokyo')::date) AS is_open
    FROM scope_orders o CROSS JOIN bounds b GROUP BY o.guest_id, (o.created_at AT TIME ZONE 'Asia/Tokyo')::date
  ), activity_days AS (
    SELECT d.*, COALESCE(o.is_open, false) AS is_open,
      CASE WHEN d.points >= 2 AND ($6 = 'observed' OR NOT COALESCE(o.is_open, false))
        THEN extract(epoch FROM d.last_at - d.first_at) / 60.0 END::float8 AS minutes
    FROM daily_observations d LEFT JOIN daily_open o USING (guest_id, day)
  ), registration_counts AS (
    SELECT date_bin($3::interval, g.created_at, '2000-01-01T00:00:00+09:00'::timestamptz) AS at, count(*)::int AS registered
    FROM guests g CROSS JOIN bounds b WHERE g.created_at >= b.start_at AND g.created_at < b.end_at GROUP BY 1
  ), registration_timeline AS (
    SELECT t.at AS key, to_char(t.at AT TIME ZONE 'Asia/Tokyo', 'MM/DD HH24:MI') AS name,
      CASE WHEN b.start_at < b.end_at AND t.at < b.end_at THEN COALESCE(c.registered, 0) END AS registered,
      CASE WHEN b.start_at < b.end_at AND t.at < b.end_at THEN sum(COALESCE(c.registered, 0)) OVER (ORDER BY t.at)::int END AS "cumulativePeriod",
      CASE WHEN b.start_at < b.end_at AND t.at < b.end_at THEN ((SELECT count(*) FROM guests g WHERE g.created_at < b.start_at AND g.created_at < b.end_at)
        + sum(COALESCE(c.registered, 0)) OVER (ORDER BY t.at))::int END AS "cumulativeTotal"
    FROM buckets t LEFT JOIN registration_counts c USING(at) CROSS JOIN bounds b ORDER BY t.at
  ), days AS (
    SELECT d::date AS day FROM generate_series(($1::timestamptz AT TIME ZONE 'Asia/Tokyo')::date,
      (($2::timestamptz - interval '1 microsecond') AT TIME ZONE 'Asia/Tokyo')::date, interval '1 day') d
    CROSS JOIN bounds b WHERE b.start_at < b.end_at
      AND d::date <= ((b.end_at - interval '1 microsecond') AT TIME ZONE 'Asia/Tokyo')::date
  ), daily_purchases AS (
    SELECT (o.created_at AT TIME ZONE 'Asia/Tokyo')::date AS day, o.guest_id, sum(o.total_amount)::float8 AS spending
    FROM scope_orders o JOIN population p ON p.id = o.guest_id WHERE o.status = 'completed' GROUP BY 1, 2
  ), daily_finance AS (
    SELECT day, count(*)::int AS buyers, count(*)::int AS population, avg(spending)::float8 AS "averageSpend",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY spending)::float8 AS "medianSpend" FROM daily_purchases GROUP BY day
  ), daily_registered_finance AS (
    SELECT d.day, count(p.id) FILTER (WHERE f.guest_id IS NOT NULL)::int AS buyers, count(p.id)::int AS population,
      avg(COALESCE(f.spending,0))::float8 AS "averageSpend",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(f.spending,0))::float8 AS "medianSpend"
    FROM days d JOIN population p ON true LEFT JOIN daily_purchases f ON f.day = d.day AND f.guest_id = p.id
    JOIN guests g ON g.id = p.id AND g.created_at < (d.day + 1)::timestamp AT TIME ZONE 'Asia/Tokyo'
    WHERE $5 = 'registered' GROUP BY d.day
  ), daily_stays AS (
    SELECT day, avg(minutes)::float8 AS "averageStayMinutes", percentile_cont(0.5) WITHIN GROUP (ORDER BY minutes)::float8 AS "medianStayMinutes",
      count(minutes)::int AS "staySamples", count(*) FILTER (WHERE points < 2)::int AS "singleObservationDays",
      count(*) FILTER (WHERE is_open)::int AS "openDays" FROM activity_days GROUP BY day
  ), daily_registrations AS (
    SELECT (g.created_at AT TIME ZONE 'Asia/Tokyo')::date AS day, count(*)::int AS registered
    FROM guests g CROSS JOIN bounds b WHERE g.created_at >= b.start_at AND g.created_at < b.end_at GROUP BY 1
  ), daily AS (
    SELECT d.day::text AS key, to_char(d.day, 'MM/DD') AS name, COALESCE(r.registered,0) AS registered,
      COALESCE(f.buyers,0) AS buyers, COALESCE(f.population,0) AS population, f."averageSpend", f."medianSpend", s."averageStayMinutes", s."medianStayMinutes",
      COALESCE(s."staySamples",0) AS "staySamples", COALESCE(s."singleObservationDays",0) AS "singleObservationDays", COALESCE(s."openDays",0) AS "openDays"
    FROM days d LEFT JOIN daily_registrations r USING(day)
    LEFT JOIN (SELECT * FROM daily_finance WHERE $5 = 'purchasers' UNION ALL SELECT * FROM daily_registered_finance) f USING(day)
    LEFT JOIN daily_stays s USING(day) ORDER BY d.day
  ), finance AS (
    SELECT count(*)::int AS population, count(*) FILTER (WHERE purchases > 0)::int AS buyers,
      COALESCE(sum(spending),0)::float8 AS revenue, avg(spending)::float8 AS "averageSpend",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY spending)::float8 AS "medianSpend",
      avg(orders)::float8 AS "averageOrders", avg(stores)::float8 AS "averageStores" FROM guest_totals
  ), stay_summary AS (
    SELECT avg(minutes)::float8 AS "averageStayMinutes", percentile_cont(0.5) WITHIN GROUP (ORDER BY minutes)::float8 AS "medianStayMinutes",
      count(minutes)::int AS "staySamples", count(*)::int AS "observationDays",
      count(*) FILTER (WHERE points < 2)::int AS "singleObservationDays", count(*) FILTER (WHERE is_open)::int AS "openDays" FROM activity_days
  ), summary AS (
    SELECT f.*, s.*, (SELECT count(*)::int FROM guests g CROSS JOIN bounds b WHERE g.created_at >= b.start_at AND g.created_at < b.end_at) AS registered,
      (SELECT count(*)::int FROM guests g CROSS JOIN bounds b WHERE g.created_at < b.end_at) AS "totalRegistered" FROM finance f CROSS JOIN stay_summary s
  ), money_ranges AS (
    SELECT * FROM (VALUES (0,0,1,'0円'), (1,1,500,'1–499円'),(2,500,1000,'500–999円'),(3,1000,2000,'1,000–1,999円'),
      (4,2000,5000,'2,000–4,999円'),(5,5000,1e30,'5,000円以上')) r(position,lower,upper,name)
  ), money_histogram AS (
    SELECT r.name,count(g.id)::int AS guests FROM money_ranges r LEFT JOIN guest_totals g ON g.spending >= r.lower AND g.spending < r.upper
    GROUP BY r.position,r.name ORDER BY r.position
  ), time_ranges AS (
    SELECT * FROM (VALUES (0,0,5,'5分未満'),(1,5,15,'5–15分'),(2,15,30,'15–30分'),(3,30,60,'30–60分'),(4,60,120,'60–120分'),(5,120,1e30,'120分以上')) r(position,lower,upper,name)
  ), time_histogram AS (
    SELECT r.name,count(a.minutes)::int AS days FROM time_ranges r LEFT JOIN activity_days a ON a.minutes >= r.lower AND a.minutes < r.upper
    GROUP BY r.position,r.name ORDER BY r.position
  ) SELECT (SELECT row_to_json(s) FROM summary s) AS summary,
    (SELECT COALESCE(json_agg(r),'[]') FROM registration_timeline r) AS registrations,
    (SELECT COALESCE(json_agg(d),'[]') FROM daily d) AS daily,
    (SELECT COALESCE(json_agg(m),'[]') FROM money_histogram m) AS "spendingDistribution",
    (SELECT COALESCE(json_agg(t),'[]') FROM time_histogram t) AS "stayDistribution"`;
}
export async function loadGuestAnalytics(
  client: PoolClient,
  filters: GuestFilters,
): Promise<GuestData> {
  const {
    rows: [meta],
  } = await client.query(
    "SELECT transaction_timestamp() AS at, to_regclass('activity_log') IS NOT NULL AS activity",
  );
  const {
    rows: [data],
  } = await client.query(guestSQL(meta.activity), [
    filters.start,
    filters.end,
    intervals[filters.interval],
    filters.channel,
    filters.cohort,
    filters.stay,
  ]);
  return { ...data, filters, generatedAt: meta.at.toISOString(), hasActivityLog: meta.activity };
}
