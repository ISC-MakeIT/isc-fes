import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Pool, type PoolClient } from "pg";
import { migrate, seed } from "./fixtures";
import { loadOverview } from "../src/server/overview-queries";
import { overviewCSV } from "../src/lib/overview";
import { makeCSV } from "../src/lib/csv";
import type { OverviewFilters } from "../src/lib/types";

const url = process.env.TEST_ANALYTICS_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("Overall cumulative report with PostgreSQL", () => {
  const schema = `overview_test_${crypto.randomUUID().replaceAll("-", "")}`;
  const pool = new Pool({ connectionString: url, max: 1 });
  let client: PoolClient;
  const filters: OverviewFilters = {
    start: "2026-10-24T09:45:00+09:00",
    end: "2026-10-24T12:00:00+09:00",
    interval: "30m",
    sales: "completed",
  };
  const query = (changes: Partial<OverviewFilters> = {}) =>
    loadOverview(client, { ...filters, ...changes });
  beforeAll(async () => {
    client = await pool.connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, pg_catalog`);
    await migrate(client);
    await seed(client);
  });
  beforeEach(async () => {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
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
  test("all stores accumulate original totals and count-weighted rates; bucket labels are exclusive end times", async () => {
    const d = await query();
    expect(d.timeline.map((r) => r.orders)).toEqual([0, 3, 4, 5, 6]);
    expect(d.timeline.map((r) => r.revenue)).toEqual([0, 1400, 1400, 1700, 1700]);
    expect(d.timeline.map((r) => r.name)).toEqual([
      "10/24 10:00",
      "10/24 10:30",
      "10/24 11:00",
      "10/24 11:30",
      "10/24 12:00",
    ]);
    expect(d.timeline[0].cancellationRate).toBeNull();
    expect(d.timeline[0].faceRate).toBeNull();
    expect(d.timeline[1].cancellationRate).toBeCloseTo(100 / 3);
    expect(d.timeline[2].cancellationRate).toBe(25);
    expect(d.timeline[3].faceRate).toBe(20);
    expect(d.summary).toEqual({
      orders: 6,
      salesOrders: 3,
      revenue: 1700,
      completed: 3,
      cancelled: 1,
      face: 1,
      cancellationRate: 100 / 6,
      faceRate: 100 / 6,
    });
    expect(Date.parse(d.timeline[0].bucketStart)).toBe(Date.parse(filters.start));
    expect(new Set(d.timeline.map((r) => r.key)).size).toBe(d.timeline.length);
  });
  test("revenue basis changes money and sales order counts but never the denominator for rates", async () => {
    const accepted = await query({ sales: "accepted" });
    const all = await query({ sales: "all" });
    expect(accepted.summary.revenue).toBe(2200);
    expect(accepted.summary.salesOrders).toBe(5);
    expect(all.summary.revenue).toBe(2500);
    expect(all.summary.salesOrders).toBe(6);
    expect(accepted.summary.orders).toBe(6);
    expect(all.summary.cancellationRate).toBeCloseTo(100 / 6);
    expect(all.summary.faceRate).toBeCloseTo(100 / 6);
  });
  test("partial boundaries exclude outside orders and carry totals through empty buckets and midnight", async () => {
    const partial = await query({
      start: "2026-10-24T10:07:12+09:00",
      end: "2026-10-24T11:03:45+09:00",
    });
    expect(partial.timeline.map((r) => r.orders)).toEqual([1, 2, 3]);
    expect(partial.summary.revenue).toBe(300);
    expect(partial.summary.faceRate).toBeCloseTo(100 / 3);
    expect(Date.parse(partial.timeline.at(-1)!.key)).toBe(Date.parse(partial.filters.end));
    const across = await query({ end: "2026-10-25T01:00:00+09:00", interval: "1h" });
    expect(across.timeline.at(-1)!.orders).toBe(7);
    expect(across.timeline.at(-1)!.revenue).toBe(2000);
    expect(across.timeline.at(-2)!.orders).toBe(7);
    const csv = overviewCSV(partial);
    expect(csv[1][10]).toBe("2026-10-24 10:07:12");
    expect(csv.at(-1)![1]).toBe("2026-10-24 11:03:45");
  });
  test("empty periods have zero counts and blank rates; no future orders or extrapolated future points", async () => {
    const empty = await query({
      start: "2026-10-23T00:00:00+09:00",
      end: "2026-10-23T01:00:00+09:00",
    });
    expect(empty.timeline).toHaveLength(2);
    expect(empty.summary.orders).toBe(0);
    expect(empty.summary.cancellationRate).toBeNull();
    expect(empty.summary.faceRate).toBeNull();
    const {
      rows: [clock],
    } = await client.query("SELECT transaction_timestamp() AS now");
    const now = clock.now.getTime();
    const start = new Date(now - 60000).toISOString();
    const end = new Date(now + 86400000).toISOString();
    await client.query(
      "UPDATE orders SET created_at = $1, updated_at = $1 WHERE display_number = 1",
      [new Date(now + 3600000).toISOString()],
    );
    const current = await query({ start, end });
    expect(current.summary.orders).toBe(0);
    expect(current.timeline.every((r) => Date.parse(r.key) <= now)).toBe(true);
    expect(Date.parse(current.timeline.at(-1)!.key)).toBe(now);
    const future = await query({ start: new Date(now + 60000).toISOString(), end });
    expect(future.timeline).toEqual([]);
    expect(future.summary.revenue).toBe(0);
    expect(overviewCSV(future)).toHaveLength(1);
  });
  test("unified CSV has one row per instant and numeric columns with rate numerators and denominators", async () => {
    const d = await query();
    const [header, ...rows] = overviewCSV(d);
    expect(header[0]).toBe("名前");
    expect(rows).toHaveLength(d.timeline.length);
    expect(rows.every((r) => r.length === header.length)).toBe(true);
    expect(new Set(rows.map((r) => r[1])).size).toBe(rows.length);
    expect(rows[0].slice(2, 10)).toEqual([0, 0, null, null, 0, 0, 0, 0]);
    const last = rows.at(-1)!;
    expect(last.slice(2, 10)).toEqual([1700, 6, 100 / 6, 100 / 6, 1, 1, 3, 3]);
    expect(last.slice(2, 10).every((v) => typeof v === "number")).toBe(true);
    expect(last[15]).toBe("受取完了のみ");
    expect(makeCSV([header, ...rows]).startsWith('\uFEFF"名前","集計時点JST"')).toBe(true);
  });
});
