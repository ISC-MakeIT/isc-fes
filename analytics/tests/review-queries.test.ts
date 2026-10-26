import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Pool, type PoolClient } from "pg";
import { loadReviewAnalytics, loadReviewComments } from "../src/server/review-queries";
import { loadMetadata } from "../src/server/queries";
import { reviewCommentCSV } from "../src/lib/reviews";
import { makeCSV } from "../src/lib/csv";
import type { ReviewFilters } from "../src/lib/types";
import { ids, migrate, seed } from "./fixtures";
const url = process.env.TEST_ANALYTICS_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("Review analytics with real PostgreSQL migrations", () => {
  const schema = `analytics_review_test_${crypto.randomUUID().replaceAll("-", "")}`;
  const pool = new Pool({ connectionString: url, max: 1 });
  let client: PoolClient;
  let guestID: string;
  const f: ReviewFilters = {
    start: "2026-10-24T10:00:00+09:00",
    end: "2026-10-24T12:00:00+09:00",
    interval: "30m",
    audience: "all",
    trigger: "",
    missingTrigger: false,
    ratingMin: 1,
    ratingMax: 5,
    comment: "all",
    search: "",
    page: 0,
  };
  const query = (changes: Partial<ReviewFilters> = {}) =>
    loadReviewAnalytics(client, { ...f, ...changes });
  async function review(
    time: string,
    rating: number,
    trigger: string | null,
    comment: string | null,
    guest: string | null = null,
    account: string | null = null,
  ) {
    await client.query(
      "INSERT INTO reviews(created_at,rating,trigger,comment,guest_id,account_id) VALUES($1,$2,$3,$4,$5,$6)",
      [`2026-10-24T${time}:00+09:00`, rating, trigger, comment, guest, account],
    );
  }
  beforeAll(async () => {
    client = await pool.connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema},pg_catalog`);
    await migrate(client);
    await seed(client);
    const {
      rows: [guest],
    } = await client.query("SELECT id FROM guests LIMIT 1");
    guestID = guest.id;
    await review("09:59", 1, "cart_item_added", "期間外");
    await review("10:00", 5, "order_completed", "とても使いやすい！", guestID, ids.staff);
    await review("10:05", 1, "order_completed", null);
    await review("10:15", 3, "pickup_completed", "受け取りが分かりやすい", null, ids.staff);
    await review("10:30", 4, "store_home_opened", "操作が簡単", guestID);
    await review("11:00", 2, " menu_updated ", "  ");
    await review("11:15", 4, "topping_created", "改善してほしい\n通知", guestID, ids.staff);
    await review("11:30", 1, "new_future_trigger", '<script>alert("x")</script>\n100%_literal');
    await review("11:40", 5, null, "未設定");
    await review("11:45", 3, "  ", "\n\t");
    await review("12:00", 5, "menu_created", "終了境界");
  });
  beforeEach(async () => {
    await client.query("BEGIN");
  });
  afterEach(async () => {
    await client.query("ROLLBACK");
  });
  afterAll(async () => {
    if (client) {
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      client.release();
    }
    await pool.end();
  });
  test("overall statistics and five-rating shares reconcile with filtered rows", async () => {
    await client.query("SET TRANSACTION READ ONLY");
    const d = await query();
    expect(d.summary.count).toBe(9);
    expect(d.summary.averageRating).toBeCloseTo(28 / 9);
    expect(d.summary.medianRating).toBe(3);
    const high = await query({ ratingMin: 4 });
    expect(high.summary.medianRating).toBe(4.5);
    expect(high.summary.averageRating).toBe(4.5);
    expect(d.summary.commentCount).toBe(6);
    expect(d.summary.commentRate).toBeCloseTo((100 * 6) / 9);
    expect(d.summary.highRate).toBeCloseTo((100 * 4) / 9);
    expect(d.summary.lowRate).toBeCloseTo((100 * 3) / 9);
    expect(d.ratings.map((r) => r.count)).toEqual([2, 1, 2, 2, 2]);
    expect(d.ratings.reduce((sum, r) => sum + (r.share ?? 0), 0)).toBeCloseTo(100);
    expect(d.reviews).toHaveLength(9);
    expect(d.reviews.every((r) => r.createdLabel.startsWith("2026-10-24 "))).toBe(true);
    expect(d.reviews.some((r) => r.comment === "終了境界" || r.comment === "期間外")).toBe(false);
    const meta = await loadMetadata(client);
    expect(new Date(meta.firstReview!).toISOString()).toBe("2026-10-24T00:59:00.000Z");
    expect(meta.reviewTriggers).toContain("menu_updated");
    expect(meta.reviewTriggers).not.toContain("");
    const text = JSON.stringify(d);
    expect(text).not.toContain(guestID);
    expect(text).not.toContain(ids.staff);
  });
  test("trigger classifies audience even if identities are absent, opposite or both; unknown triggers remain visible", async () => {
    const d = await query();
    const guest = d.audiences.find((r) => r.key === "guest")!;
    const store = d.audiences.find((r) => r.key === "store")!;
    const unknown = d.audiences.find((r) => r.key === "unknown")!;
    expect(guest.count).toBe(3);
    expect(guest.averageRating).toBe(3);
    expect(guest.medianRating).toBe(3);
    expect(store.count).toBe(3);
    expect(store.averageRating).toBeCloseTo(10 / 3);
    expect(store.medianRating).toBe(4);
    expect(unknown.count).toBe(3);
    expect(unknown.averageRating).toBe(3);
    expect(d.triggers.find((r) => r.trigger === "new_future_trigger")?.audience).toBe("unknown");
    expect(d.triggers.find((r) => r.trigger === null)?.count).toBe(2);
    for (const a of d.audiences) {
      const rating = d.audienceRatings.filter((r) => r.audience === a.key);
      expect(rating).toHaveLength(5);
      expect(rating.reduce((s, r) => s + r.count, 0)).toBe(a.count);
      expect(rating.reduce((s, r) => s + (r.share ?? 0), 0)).toBeCloseTo(100);
    }
    expect((await query({ audience: "store" })).reviews.every((r) => r.audience === "store")).toBe(
      true,
    );
    expect((await query({ audience: "unknown" })).summary.count).toBe(3);
  });
  test("audience/trigger/rating/comment/search conditions compose and percent signs are literal", async () => {
    expect((await query({ trigger: "order_completed" })).summary.averageRating).toBe(3);
    const filtered = await query({ audience: "guest", ratingMin: 3, comment: "with" });
    expect(filtered.summary.count).toBe(2);
    expect(filtered.summary.averageRating).toBe(4);
    expect(filtered.summary.medianRating).toBe(4);
    const missing = await query({ missingTrigger: true });
    expect(missing.summary.count).toBe(2);
    expect(missing.summary.averageRating).toBe(4);
    expect((await query({ comment: "without" })).summary.count).toBe(3);
    expect((await query({ search: "通知" })).reviews[0].trigger).toBe("topping_created");
    expect((await query({ search: "%_" })).summary.count).toBe(1);
    const literal = await query({ search: "' OR 1=1 --" });
    expect(literal.summary.count).toBe(0);
    expect((await query({ trigger: "' OR 1=1 --" })).summary.count).toBe(0);
  });
  test("time series are dense in JST, weight original reviews, and leave empty ratings missing", async () => {
    const d = await query();
    expect(d.timeline).toHaveLength(12);
    const store = d.timeline.filter((r) => r.audience === "store");
    expect(store.map((r) => r.count)).toEqual([0, 1, 2, 0]);
    expect(store.map((r) => r.averageRating)).toEqual([null, 4, 3, null]);
    expect(d.timeline.filter((r) => r.audience === "guest").map((r) => r.medianRating)).toEqual([
      3,
      null,
      null,
      null,
    ]);
    expect(
      d.timeline.filter((r) => r.audience === "unknown").reduce((n, r) => n + r.count, 0),
    ).toBe(3);
    expect(store[0].name).toBe("10/24 10:00");
    const partial = await query({
      start: "2026-10-24T10:05:00+09:00",
      end: "2026-10-24T10:15:00+09:00",
    });
    expect(partial.summary.count).toBe(1);
    expect(partial.summary.averageRating).toBe(1);
    expect(partial.timeline).toHaveLength(3);
  });
  test("empty groups and future periods return zero counts and null statistics without invented observations", async () => {
    const d = await query({ audience: "guest", trigger: "menu_created" });
    expect(d.summary.count).toBe(0);
    expect(d.summary.averageRating).toBeNull();
    expect(d.summary.medianRating).toBeNull();
    expect(d.ratings.every((r) => r.count === 0 && r.share === null)).toBe(true);
    expect(d.audiences.every((r) => r.averageRating === null && r.commentRate === null)).toBe(true);
    expect(d.reviews).toEqual([]);
    const future = await query({
      start: "2099-10-24T10:00:00+09:00",
      end: "2099-10-24T12:00:00+09:00",
    });
    expect(future.timeline).toEqual([]);
    expect(future.summary.count).toBe(0);
  });
  test("comment pagination does not limit aggregate statistics or full CSV export", async () => {
    await client.query(
      "INSERT INTO reviews(created_at,rating,trigger,comment) SELECT '2026-10-24T11:59:00+09:00',4,'store_home_opened','=formula-test' FROM generate_series(1,60)",
    );
    const first = await query();
    const last = await query({ page: 99999 });
    expect(first.summary.count).toBe(69);
    expect(first.reviews).toHaveLength(50);
    expect(last.page).toBe(1);
    expect(last.reviews).toHaveLength(19);
    expect(new Set([...first.reviews, ...last.reviews].map((r) => r.key)).size).toBe(69);
    expect(first.summary).toEqual(last.summary);
    const all = await loadReviewComments(client, { ...f, page: 123 });
    expect(all).toHaveLength(69);
    const rows = reviewCommentCSV(all);
    expect(rows.slice(1).filter((r) => r[1] === "店舗側")).toHaveLength(63);
    expect(rows.slice(1).filter((r) => r[1] === "ゲスト側")).toHaveLength(3);
    expect(rows.slice(1).filter((r) => r[1] === "不明")).toHaveLength(3);
    const csv = makeCSV(rows);
    expect(csv.startsWith('\uFEFF"名前","レビュー元","rating"')).toBe(true);
    expect(csv).toContain('"\'=formula-test"');
    expect(csv).toContain("改善してほしい\n通知");
    expect(csv).not.toContain(guestID);
    expect(csv).not.toContain(ids.staff);
  });
});
