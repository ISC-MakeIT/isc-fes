import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Pool, type PoolClient } from "pg";
import { loadAnalytics, loadMetadata } from "../src/server/queries";
import { parseFilters, toParams } from "../src/lib/filters";
import type { Filters } from "../src/lib/types";
import { ids, migrate, seed } from "./fixtures";

const url = process.env.TEST_ANALYTICS_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("PostgreSQL analytics against real migrations", () => {
  const schema = `analytics_test_${crypto.randomUUID().replaceAll("-", "")}`;
  const pool = new Pool({ connectionString: url, max: 1 });
  let client: PoolClient;
  const filters: Filters = {
    start: "2026-10-24T10:00:00+09:00",
    end: "2026-10-24T12:00:00+09:00",
    interval: "30m",
    store: "",
    menu: "",
    status: "all",
    channel: "all",
    sales: "completed",
    congestionMetric: "preparing",
    low: 1,
    high: 3,
  };
  const query = (changes: Partial<Filters> = {}) =>
    loadAnalytics(client, parseFilters(toParams({ ...filters, ...changes })));
  beforeAll(async () => {
    client = await pool.connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, pg_catalog`);
    await migrate(client);
    await seed(client);
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  });
  afterAll(async () => {
    if (client) {
      await client.query("ROLLBACK");
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      client.release();
    }
    await pool.end();
  });
  test("bounds, completed sales, item/topping totals, and duration percentiles", async () => {
    const data = await query();
    expect(data.summary.orders).toBe(6);
    expect(data.summary.completed).toBe(3);
    expect(data.summary.pending).toBe(1);
    expect(data.summary.ready).toBe(1);
    expect(data.summary.cancelled).toBe(1);
    expect(data.summary.revenue).toBe(1700);
    expect(data.summary.units).toBe(5);
    expect(data.summary.cancellationRate).toBeCloseTo(100 / 6);
    expect(data.summary.faceRate).toBeCloseTo(100 / 6);
    expect(data.summary.averageMinutes).toBeCloseTo(52 / 3);
    expect(data.summary.medianMinutes).toBe(10);
    expect(data.summary.p90Minutes).toBeCloseTo(34);
    // Preparation includes ready/cancelled orders; pickup only includes completed orders.
    expect(data.summary.preparationSamples).toBe(5);
    expect(data.summary.preparationMinutes).toBeCloseTo(51 / 5);
    expect(data.summary.preparationMedianMinutes).toBe(5);
    expect(data.summary.preparationP90Minutes).toBeCloseTo(22);
    expect(data.summary.pickupSamples).toBe(3);
    expect(data.summary.pickupMinutes).toBeCloseTo(16 / 3);
    expect(data.summary.pickupMedianMinutes).toBe(5);
    expect(data.summary.pickupP90Minutes).toBeCloseTo(9);
    const storeA = data.stores.find((r) => r.key === ids.a)!;
    expect(storeA.preparationMedianMinutes).toBe(7.5);
    expect(storeA.preparationP90Minutes).toBeCloseTo(24);
    expect(storeA.pickupMedianMinutes).toBe(7.5);
    expect(storeA.pickupP90Minutes).toBeCloseTo(9.5);
    expect(data.summary.cancellationWaitMinutes).toBe(15);
    expect(data.timeline).toHaveLength(4);
    expect(data.timeline.reduce((n, r) => n + r.orders, 0)).toBe(6);
    expect(data.menus.reduce((n, r) => n + r.revenue, 0)).toBe(1700);
    expect(data.menus.reduce((n, r) => n + r.units, 0)).toBe(5);
    expect(data.durations.map((r) => r.orders)).toEqual([1, 0, 1, 0, 1, 0]);
  });
  test("store, menu, channel, status and revenue-basis filters compose", async () => {
    const menu = await query({ store: ids.a, menu: ids.m1 });
    expect(menu.summary.orders).toBe(4);
    expect(menu.summary.revenue).toBe(1000);
    expect(menu.summary.units).toBe(3);
    expect((await query({ channel: "face" })).summary.revenue).toBe(300);
    expect((await query({ channel: "mobile" })).summary.revenue).toBe(1400);
    expect((await query({ sales: "all" })).summary.revenue).toBe(2500);
    expect((await query({ sales: "accepted" })).summary.revenue).toBe(2200);
    const cancelled = await query({ status: "cancelled" });
    expect(cancelled.summary.cancellationRate).toBe(100);
    expect(cancelled.summary.averageMinutes).toBeNull();
    expect(cancelled.summary.revenue).toBe(0);
    expect(cancelled.summary.preparationMedianMinutes).toBe(10);
    expect(cancelled.summary.preparationSamples).toBe(1);
    expect(cancelled.summary.pickupMedianMinutes).toBeNull();
    expect(cancelled.summary.pickupSamples).toBe(0);
  });
  test("empty results distinguish absent rates and durations from zero", async () => {
    const data = await query({ store: ids.b, channel: "face" });
    expect(data.summary.orders).toBe(0);
    expect(data.summary.revenue).toBe(0);
    expect(data.summary.cancellationRate).toBeNull();
    expect(data.summary.averageMinutes).toBeNull();
    expect(data.summary.preparationMedianMinutes).toBeNull();
    expect(data.summary.preparationP90Minutes).toBeNull();
    expect(data.summary.pickupMedianMinutes).toBeNull();
    expect(data.summary.pickupP90Minutes).toBeNull();
    expect(data.summary.preparationSamples).toBe(0);
    expect(data.summary.pickupSamples).toBe(0);
    expect(data.timeline.every((r) => r.orders === 0 && r.averageMinutes === null)).toBe(true);
  });
  test("congestion carries prior history, includes pre-period backlog and ignores cohort filters", async () => {
    const data = await query();
    const a = data.congestion.filter((r) => r.storeId === ids.a);
    expect(a.map((r) => r.reported)).toEqual([3, 2, 2, 2]);
    expect(a.map((r) => r.preparing)).toEqual([1, 1, 2, 2]);
    expect(a[0].active).toBe(2);
    expect(a[0].inferred).toBe(2);
    expect(a[0].gap).toBe(-1);
    expect(
      data.congestion.filter((r) => r.storeId === ids.b).every((r) => r.reported === null),
    ).toBe(true);
    const filtered = await query({ menu: ids.m1, channel: "face", status: "completed" });
    expect(filtered.congestion).toEqual(data.congestion);
    const carry = await query({
      start: "2026-10-24T09:05:00+09:00",
      end: "2026-10-24T09:10:00+09:00",
    });
    expect(carry.congestion.find((r) => r.storeId === ids.a)?.reported).toBe(1);
  });
  test("hour and weekday aggregates use JST and metadata contains no personal data", async () => {
    const data = await query();
    expect(data.hours.find((r) => r.key === "10")?.orders).toBe(4);
    expect(data.weekdays.find((r) => r.key === "6")?.orders).toBe(6);
    const meta = await loadMetadata(client);
    expect(meta.stores).toHaveLength(2);
    expect(meta.menus).toHaveLength(3);
    expect(meta.hasActivityLog).toBe(true);
    const payload = JSON.stringify({ meta, data });
    expect(payload).not.toContain(ids.staff);
    expect(payload).not.toContain("test@example.invalid");
  });
  test("database rejects writes in the analytics read-only snapshot", async () => {
    await client.query("SAVEPOINT write_check");
    await expect(client.query("UPDATE stores SET name = 'unexpected'")).rejects.toMatchObject({
      code: "25006",
    });
    await client.query("ROLLBACK TO SAVEPOINT write_check");
  });
  test("future intervals do not extrapolate unresolved orders", async () => {
    const data = await query({
      start: "2099-10-24T10:00:00+09:00",
      end: "2099-10-24T12:00:00+09:00",
    });
    expect(data.congestion).toEqual([]);
    expect(data.summary.orders).toBe(0);
  });
  test("missing history and conflicting same-time observations remain unknown", async () => {
    await client.query("ROLLBACK");
    await client.query("BEGIN");
    try {
      await client.query("ALTER TABLE activity_log RENAME TO saved_activity_log");
      const absent = await query();
      expect(absent.hasActivityLog).toBe(false);
      expect(absent.summary.revenue).toBe(1700);
      expect(absent.congestion.every((r) => r.reported === null && r.gap === null)).toBe(true);
      await client.query("ALTER TABLE saved_activity_log RENAME TO activity_log");
      for (const level of [1, 3]) {
        await client.query(
          `INSERT INTO activity_log(occurred_at,event_type,store_id,subject_type,subject_id,actor_account_id,payload)
          VALUES('2026-10-24T11:00:00+09:00','store.updated',$1,'store',$1,$2,$3)`,
          [ids.a, ids.staff, { after: { congestion_level: level } }],
        );
      }
      const ambiguous = await query();
      expect(
        ambiguous.congestion.filter((r) => r.storeId === ids.a).map((r) => r.reported),
      ).toEqual([3, 2, null, null]);
    } finally {
      await client.query("ROLLBACK");
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    }
  });
});
