import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Pool, type PoolClient } from "pg";
import { loadGuestAnalytics } from "../src/server/guest-queries";
import type { GuestFilters } from "../src/lib/types";
import { ids, migrate, seed } from "./fixtures";
const url = process.env.TEST_ANALYTICS_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("Guest analytics with real PostgreSQL migrations", () => {
  const schema = `analytics_guest_test_${crypto.randomUUID().replaceAll("-", "")}`;
  const pool = new Pool({ connectionString: url, max: 1 });
  let client: PoolClient;
  let buyer: string;
  let firstOrder: string;
  const filters: GuestFilters = {
    start: "2026-10-24T10:00:00+09:00",
    end: "2026-10-24T12:00:00+09:00",
    interval: "30m",
    channel: "mobile",
    cohort: "purchasers",
    cumulative: "total",
    stay: "closed",
  };
  const query = (changes: Partial<GuestFilters> = {}) =>
    loadGuestAnalytics(client, { ...filters, ...changes });
  async function order(at: string, end: string | null, guest = buyer) {
    const {
      rows: [cart],
    } = await client.query("SELECT id FROM carts WHERE guest_id=$1 AND store_id=$2", [
      guest,
      ids.a,
    ]);
    const {
      rows: [o],
    } = await client.query(
      `INSERT INTO orders(store_id,guest_id,status,total_amount,display_number,origin_cart_id,origin_cart_version,store_name,room_name,created_at,updated_at,ready_at,completed_at)
      VALUES($1,$2,$3,100,(SELECT max(display_number)+1 FROM orders WHERE store_id=$1),$4,
      (SELECT max(origin_cart_version)+1 FROM orders WHERE origin_cart_id=$4),'テスト','501教室',$5::timestamptz,COALESCE($6::timestamptz,$5::timestamptz),$6::timestamptz,$6::timestamptz) RETURNING id`,
      [ids.a, guest, end ? "completed" : "pending", cart.id, at, end],
    );
    return o.id as string;
  }
  beforeAll(async () => {
    client = await pool.connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema},pg_catalog`);
    await migrate(client);
    await seed(client);
    await client.query("UPDATE guests SET created_at='2026-10-24T10:00:00+09:00'");
    const {
      rows: [o],
    } = await client.query(
      "SELECT id,guest_id FROM orders WHERE created_at='2026-10-24T10:00:00+09:00'",
    );
    buyer = o.guest_id;
    firstOrder = o.id;
    const {
      rows: [sharedCart],
    } = await client.query("INSERT INTO carts(guest_id,store_id) VALUES($1,$2) RETURNING id", [
      buyer,
      ids.b,
    ]);
    await client.query("UPDATE orders SET guest_id=$1,origin_cart_id=$3 WHERE store_id=$2", [
      buyer,
      ids.b,
      sharedCart.id,
    ]);
    await client.query(
      "INSERT INTO guests(created_at) VALUES('2026-10-24T09:00:00+09:00'),('2026-10-24T11:00:00+09:00'),('2099-10-24T10:00:00+09:00')",
    );
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
  test("spend is per guest across stores, not per order; channels exclude proxy guests by default", async () => {
    const d = await query();
    expect(d.summary.population).toBe(1);
    expect(d.summary.buyers).toBe(1);
    expect(d.summary.revenue).toBe(1400);
    expect(d.summary.averageSpend).toBe(1400);
    expect(d.summary.medianSpend).toBe(1400);
    expect(d.summary.averageOrders).toBe(2);
    expect(d.summary.averageStores).toBe(2);
    expect(d.daily[0].averageSpend).toBe(1400);
    const all = await query({ channel: "all" });
    expect(all.summary.population).toBe(2);
    expect(all.summary.averageSpend).toBe(850);
    expect(all.summary.medianSpend).toBe(850);
    expect(all.summary.averageStayMinutes).toBe(25);
    expect(all.summary.medianStayMinutes).toBe(25);
    expect(d.spendingDistribution.reduce((sum, r) => sum + r.guests, 0)).toBe(1);
    expect(JSON.stringify(d)).not.toContain(buyer);
    expect(JSON.stringify(d)).not.toContain(ids.staff);
  });
  test("registration cumulative includes pre-period and non-buyers independently of filters", async () => {
    const d = await query();
    expect(d.summary.registered).toBe(9);
    expect(d.summary.totalRegistered).toBe(10);
    expect(d.registrations.map((r) => r.registered)).toEqual([8, 0, 1, 0]);
    expect(d.registrations.map((r) => r.cumulativePeriod)).toEqual([8, 8, 9, 9]);
    expect(d.registrations.map((r) => r.cumulativeTotal)).toEqual([9, 9, 10, 10]);
    const face = await query({ channel: "face", cohort: "registered", cumulative: "period" });
    expect(face.registrations).toEqual(d.registrations);
    expect(face.summary.population).toBe(9);
    expect(face.summary.revenue).toBe(300);
    expect(face.summary.averageSpend).toBeCloseTo(300 / 9);
    expect(face.summary.medianSpend).toBe(0);
    const registered = await query({ cohort: "registered" });
    expect(registered.summary.averageSpend).toBeCloseTo(1400 / 9);
    expect(registered.summary.medianSpend).toBe(0);
    expect(registered.spendingDistribution[0].guests).toBe(8);
    expect(registered.daily[0].averageSpend).toBeCloseTo(1400 / 9);
    expect(registered.daily[0].population).toBe(9);
    expect(registered.daily[0].buyers).toBe(1);
  });
  test("partial buckets preserve the pre-period baseline and exclude boundary orders", async () => {
    const d = await query({ start: "2026-10-24T10:05:00+09:00", end: "2026-10-24T11:01:00+09:00" });
    expect(d.registrations.map((r) => r.registered)).toEqual([0, 0, 1]);
    expect(d.registrations.map((r) => r.cumulativeTotal)).toEqual([9, 9, 10]);
    expect(d.summary.registered).toBe(1);
    expect(d.summary.averageSpend).toBe(500);
    expect(d.summary.averageStayMinutes).toBe(2);
  });
  test("stay uses guest actions, ignores staff-only operations, and works without history", async () => {
    expect((await query()).summary.averageStayMinutes).toBe(10);
    await client.query(
      `INSERT INTO activity_log(occurred_at,event_type,store_id,subject_type,subject_id,actor_guest_id,payload) VALUES('2026-10-24T10:20:00+09:00','order.viewed',$1,'order',$2,$3,'{}')`,
      [ids.a, firstOrder, buyer],
    );
    await client.query(
      `INSERT INTO activity_log(occurred_at,event_type,store_id,subject_type,subject_id,actor_account_id,payload) VALUES('2026-10-24T11:50:00+09:00','order.viewed',$1,'order',$2,$3,'{}')`,
      [ids.a, firstOrder, ids.staff],
    );
    const d = await query();
    expect(d.summary.averageStayMinutes).toBe(20);
    expect(d.summary.staySamples).toBe(1);
    await client.query("ALTER TABLE activity_log RENAME TO saved_activity_log");
    const absent = await query();
    expect(absent.hasActivityLog).toBe(false);
    expect(absent.summary.averageStayMinutes).toBe(10);
  });
  test("single observations are unknown; open days are excluded unless selected", async () => {
    const registered = await query({ cohort: "registered" });
    expect(registered.summary.singleObservationDays).toBe(2);
    expect(registered.summary.openDays).toBe(2);
    await order("2026-10-24T11:30:00+09:00", null);
    const closed = await query();
    expect(closed.summary.openDays).toBe(1);
    expect(closed.summary.staySamples).toBe(0);
    expect(closed.summary.averageStayMinutes).toBeNull();
    expect(closed.summary.medianStayMinutes).toBeNull();
    const observed = await query({ stay: "observed" });
    expect(observed.summary.averageStayMinutes).toBe(90);
    expect(observed.summary.staySamples).toBe(1);
    expect(observed.stayDistribution.reduce((n, r) => n + r.days, 0)).toBe(1);
  });
  test("guest days split at JST midnight, with no overnight stay added", async () => {
    await client.query(
      "UPDATE orders SET limit_exempted_by_account_id=$1 WHERE created_at='2026-10-24T12:00:00+09:00'",
      [ids.staff],
    );
    await order("2026-10-25T10:00:00+09:00", "2026-10-25T10:30:00+09:00");
    const d = await query({ end: "2026-10-26T00:00:00+09:00" });
    expect(d.summary.staySamples).toBe(2);
    expect(d.summary.averageStayMinutes).toBe(20);
    expect(d.summary.medianStayMinutes).toBe(20);
    expect(d.daily.map((r) => r.averageStayMinutes)).toEqual([10, 30]);
    expect(d.summary.averageSpend).toBe(1500);
    expect(d.daily.map((r) => r.averageSpend)).toEqual([1400, 100]);
    await order("2026-10-24T23:50:00+09:00", "2026-10-25T00:10:00+09:00");
    const crossing = await query({ end: "2026-10-26T00:00:00+09:00" });
    expect(crossing.summary.openDays).toBe(1);
    expect(crossing.summary.staySamples).toBe(1);
    expect(crossing.daily[0].averageStayMinutes).toBeNull();
    expect(crossing.daily[1].averageStayMinutes).toBe(620);
  });
  test("period boundaries clip terminal observations and future buckets remain missing", async () => {
    const clipped = await query({ end: "2026-10-24T10:10:00+09:00" });
    expect(clipped.summary.openDays).toBe(1);
    expect(clipped.summary.averageStayMinutes).toBeNull();
    expect(
      (await query({ end: "2026-10-24T10:10:00+09:00", stay: "observed" })).summary
        .averageStayMinutes,
    ).toBe(7);
    const future = await query({
      start: "2099-10-24T10:00:00+09:00",
      end: "2099-10-24T12:00:00+09:00",
    });
    expect(future.summary.registered).toBe(0);
    expect(future.summary.population).toBe(0);
    expect(
      future.registrations.every((r) => r.registered === null && r.cumulativeTotal === null),
    ).toBe(true);
    expect(future.summary.averageSpend).toBeNull();
    expect(future.daily).toEqual([]);
  });
});
