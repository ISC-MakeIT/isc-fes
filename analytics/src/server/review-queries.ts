import type { PoolClient } from "pg";
import { intervals, type ReviewComment, type ReviewData, type ReviewFilters } from "../lib/types";
import { reviewTriggerDefinitions } from "../lib/reviews";

const triggerKeys = (audience: "guest" | "store") =>
  Object.entries(reviewTriggerDefinitions)
    .filter(([, v]) => v.audience === audience)
    .map(([key]) => key);
const scopeSQL = `WITH classified AS MATERIALIZED (
  SELECT r.id,r.created_at,r.rating,NULLIF(btrim(r.trigger),'') AS trigger,
    NULLIF(btrim(r.comment,E' \\t\\n\\r'),'') AS comment,
    CASE WHEN NULLIF(btrim(r.trigger),'') = ANY($4::text[]) THEN 'guest'
      WHEN NULLIF(btrim(r.trigger),'') = ANY($5::text[]) THEN 'store' ELSE 'unknown' END AS audience,
    date_bin($3::interval,r.created_at,'2000-01-01T00:00:00+09:00'::timestamptz) AS bucket
  FROM reviews r WHERE r.created_at >= $1::timestamptz AND r.created_at < least($2::timestamptz,transaction_timestamp())
), scope AS MATERIALIZED (
  SELECT * FROM classified WHERE ($6='all' OR audience=$6)
    AND (($8::boolean AND trigger IS NULL) OR (NOT $8::boolean AND ($7='' OR trigger=$7)))
    AND rating BETWEEN $9::int AND $10::int
    AND ($11='all' OR ($11='with' AND comment IS NOT NULL) OR ($11='without' AND comment IS NULL))
    AND ($12='' OR strpos(lower(COALESCE(comment,'')),lower($12))>0)
)`;
const statsSQL = `count(r.id)::int AS count, avg(r.rating)::float8 AS "averageRating",
  percentile_cont(0.5) WITHIN GROUP (ORDER BY r.rating)::float8 AS "medianRating",
  count(r.id) FILTER(WHERE r.comment IS NOT NULL)::int AS "commentCount",
  (100.0*count(r.id) FILTER(WHERE r.comment IS NOT NULL)/NULLIF(count(r.id),0))::float8 AS "commentRate",
  (100.0*count(r.id) FILTER(WHERE r.rating>=4)/NULLIF(count(r.id),0))::float8 AS "highRate",
  (100.0*count(r.id) FILTER(WHERE r.rating<=2)/NULLIF(count(r.id),0))::float8 AS "lowRate"`;
const aggregateSQL = `${scopeSQL},
  audience_keys AS (SELECT * FROM (VALUES('guest','ゲスト側',0),('store','店舗側',1),('unknown','不明',2)) a(key,name,position)),
  summary AS (SELECT ${statsSQL} FROM scope r),
  audiences AS (SELECT a.key,a.name,${statsSQL} FROM audience_keys a LEFT JOIN scope r ON r.audience=a.key GROUP BY a.key,a.name,a.position ORDER BY a.position),
  triggers AS (SELECT r.trigger,r.audience,${statsSQL} FROM scope r GROUP BY r.trigger,r.audience ORDER BY count DESC,r.trigger NULLS LAST),
  ratings AS (SELECT i.rating,count(r.id)::int AS count,
    (100.0*count(r.id)/NULLIF((SELECT count(*) FROM scope),0))::float8 AS share
    FROM generate_series(1,5) i(rating) LEFT JOIN scope r ON r.rating=i.rating GROUP BY i.rating ORDER BY i.rating),
  audience_ratings AS (SELECT a.key AS audience,i.rating,count(r.id)::int AS count,
    (100.0*count(r.id)/NULLIF((SELECT count(*) FROM scope s WHERE s.audience=a.key),0))::float8 AS share
    FROM audience_keys a CROSS JOIN generate_series(1,5) i(rating) LEFT JOIN scope r ON r.audience=a.key AND r.rating=i.rating
    GROUP BY a.key,a.position,i.rating ORDER BY a.position,i.rating),
  buckets AS (SELECT at FROM generate_series(
    date_bin($3::interval,$1::timestamptz,'2000-01-01T00:00:00+09:00'::timestamptz),
    date_bin($3::interval,least($2::timestamptz,transaction_timestamp())-interval '1 microsecond','2000-01-01T00:00:00+09:00'::timestamptz),$3::interval) at
    WHERE $1::timestamptz < least($2::timestamptz,transaction_timestamp())),
  timeline AS (SELECT b.at AS key,to_char(b.at AT TIME ZONE 'Asia/Tokyo','MM/DD HH24:MI') AS name,a.key AS audience,${statsSQL}
    FROM buckets b CROSS JOIN audience_keys a LEFT JOIN scope r ON r.bucket=b.at AND r.audience=a.key
    GROUP BY b.at,a.key,a.position ORDER BY b.at,a.position)
  SELECT (SELECT row_to_json(s) FROM summary s) AS summary,
    (SELECT json_agg(a) FROM audiences a) AS audiences,
    (SELECT COALESCE(json_agg(t),'[]') FROM triggers t) AS triggers,
    (SELECT json_agg(r) FROM ratings r) AS ratings,
    (SELECT json_agg(r) FROM audience_ratings r) AS "audienceRatings",
    (SELECT COALESCE(json_agg(t),'[]') FROM timeline t) AS timeline`;
const commentsSQL = `${scopeSQL}
  SELECT id AS key,created_at AS "createdAt",to_char(created_at AT TIME ZONE 'Asia/Tokyo','YYYY-MM-DD HH24:MI:SS') AS "createdLabel",
    audience,trigger,rating,comment FROM scope ORDER BY created_at DESC,id DESC`;
function parameters(f: ReviewFilters) {
  return [
    f.start,
    f.end,
    intervals[f.interval],
    triggerKeys("guest"),
    triggerKeys("store"),
    f.audience,
    f.trigger,
    f.missingTrigger,
    f.ratingMin,
    f.ratingMax,
    f.comment,
    f.search,
  ];
}
function commentRows(rows: ReviewComment[]): ReviewComment[] {
  return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt).toISOString() }));
}
export async function loadReviewAnalytics(
  client: PoolClient,
  filters: ReviewFilters,
): Promise<ReviewData> {
  const {
    rows: [clock],
  } = await client.query("SELECT transaction_timestamp() AS at");
  const {
    rows: [data],
  } = await client.query(aggregateSQL, parameters(filters));
  const pageSize = 50;
  const page = Math.min(filters.page, Math.max(0, Math.ceil(data.summary.count / pageSize) - 1));
  const { rows } = await client.query(`${commentsSQL} LIMIT $13::int OFFSET $14::int`, [
    ...parameters(filters),
    pageSize,
    page * pageSize,
  ]);
  return {
    ...data,
    filters,
    generatedAt: clock.at.toISOString(),
    reviews: commentRows(rows),
    page,
    pageSize,
  };
}
export async function loadReviewComments(
  client: PoolClient,
  filters: ReviewFilters,
): Promise<ReviewComment[]> {
  const { rows } = await client.query(commentsSQL, parameters(filters));
  return commentRows(rows);
}
