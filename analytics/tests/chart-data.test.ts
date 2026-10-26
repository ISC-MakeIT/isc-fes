import { describe, expect, test } from "bun:test";
import {
  chartRows,
  dailyPoints,
  menuChartPoints,
  notionChartRows,
  storeChartPoints,
} from "../src/lib/chart-data";
import { makeCSV } from "../src/lib/csv";
import type { AnalyticsData } from "../src/lib/types";
import { parseGuestFilters, parseStoreFilters, reportParams } from "../src/lib/report-filters";

const times = ["2026-10-24T01:00:00.000Z", "2026-10-24T01:05:00.000Z"];
const data = {
  timeline: times.map((key, i) => ({ key, name: `10:0${i * 5}` })),
  stores: [
    { key: "a", name: "同名店" },
    { key: "b", name: "同名店" },
  ],
  storeTimeline: [
    {
      key: times[0],
      storeId: "a",
      revenue: 1234,
      orders: 2,
      cancellationRate: 50,
      preparationMinutes: 8,
      preparationMedianMinutes: 6,
      preparationSamples: 2,
    },
  ],
  menus: [{ key: "m", name: "メニュー / 店舗" }],
  menuTimeline: [{ key: times[0], menuId: "m", revenue: 500, units: 2, salesOrders: 1 }],
} as AnalyticsData;
describe("Chart and Notion data contracts", () => {
  test("dense store series keep count zero, rate/time gaps, duplicate names and independent medians", () => {
    const revenue = storeChartPoints(data, "revenue");
    expect(revenue.map((p) => p.value)).toEqual([1234, 0, 0, 0]);
    expect(new Set(revenue.map((p) => p.series)).size).toBe(2);
    expect(storeChartPoints(data, "cancellationRate").map((p) => p.value)).toEqual([
      50,
      null,
      null,
      null,
    ]);
    const duration = storeChartPoints(
      data,
      "preparationMinutes",
      "both",
      "preparationMedianMinutes",
    );
    expect(duration.map((p) => p.value)).toEqual([8, 6, null, null, null, null, null, null]);
    expect(duration[0].samples).toBe(2);
    expect(duration[1].samples).toBe(2);
    expect(chartRows(duration).rows).toHaveLength(2);
    expect(chartRows(duration).series).toHaveLength(4);
    const menus = menuChartPoints(data, "revenue", ["m"]);
    expect(menus.map((p) => p.value)).toEqual([500, 0]);
    expect(menuChartPoints(data, "revenue", [])).toEqual([]);
  });
  test("Notion CSV is header-first, rectangular, numeric and retains five-minute text labels and nulls", () => {
    const points = storeChartPoints(data, "cancellationRate");
    const rows = notionChartRows(points, "キャンセル率", "%", {
      start: times[0],
      end: "2026-10-24T02:00:00Z",
      interval: "5分ごと",
      generatedAt: times[1],
      conditions: "すべて",
    });
    expect(rows[0][0]).toBe("名前");
    expect(rows[0]).toHaveLength(12);
    expect(rows.slice(1).every((row) => row.length === rows[0].length)).toBe(true);
    expect(rows[1][1]).toBe("2026-10-24 10:00");
    expect(rows[3][1]).toBe("2026-10-24 10:05");
    expect(rows.slice(1).map((r) => r[4])).toEqual(points.map((p) => p.value));
    expect(rows[1][4]).toBe(50);
    expect(rows[2][4]).toBeNull();
    const csv = makeCSV(rows);
    expect(csv.startsWith('\uFEFF"名前","日時ラベルJST"')).toBe(true);
    expect(csv).toContain('"50","%"');
    expect(csv).toContain('"","%"');
    expect(makeCSV([["=SUM(1,2)", 'a"b', null, 1234]])).toBe(
      '\uFEFF"\'=SUM(1,2)","a""b","","1234"',
    );
  });
  test("daily and categorical exports keep the computed values unchanged", () => {
    const p = dailyPoints(
      [{ key: "2026-10-24", name: "10/24", median: 625.5 }],
      [{ id: "median", label: "中央値", value: (r) => r.median }],
    );
    const rows = notionChartRows(p, "購入額", "円", {
      start: times[0],
      end: times[1],
      interval: "1日",
      generatedAt: times[1],
      conditions: "購入者",
    });
    expect(rows[1][1]).toBe("2026-10-24 00:00");
    expect(rows[1][4]).toBe(625.5);
  });
  test("partial final buckets retain seconds so separate instants never collapse into the same minute label", () => {
    const points = dailyPoints(
      [
        { key: "2026-10-24T01:00:00.000Z", name: "10:00", orders: 1 },
        { key: "2026-10-24T01:00:30.125Z", name: "10:00", orders: 2 },
      ],
      [{ id: "overall", label: "全体", value: (r) => r.orders }],
    );
    const [, ...rows] = notionChartRows(points, "累計注文", "件", {
      start: times[0],
      end: times[1],
      generatedAt: times[1],
      interval: "5分",
      conditions: "全体",
    });
    expect(rows.map((r) => r[1])).toEqual(["2026-10-24 10:00", "2026-10-24 10:00:30.125"]);
    expect(rows.map((r) => r[4])).toEqual([1, 2]);
  });
});
describe("Report filters", () => {
  const params = () =>
    new URLSearchParams({ start: times[0], end: "2026-10-24T02:00:00Z", interval: "5m" });
  test("multiple stores round-trip, deduplicate and reject invalid IDs", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const p = params();
    p.set("storeIds", `${id},${id}`);
    const f = parseStoreFilters(p);
    expect(f.storeIds).toEqual([id]);
    expect(parseStoreFilters(reportParams(f))).toEqual(f);
    p.set("storeIds", "invalid");
    expect(() => parseStoreFilters(p)).toThrow();
  });
  test("store cumulative mode defaults to interval, round-trips and rejects unknown values", () => {
    const p = params();
    expect(parseStoreFilters(p).accumulation).toBe("interval");
    p.set("accumulation", "cumulative");
    const f = parseStoreFilters(p);
    expect(f.accumulation).toBe("cumulative");
    expect(parseStoreFilters(reportParams(f))).toEqual(f);
    p.set("accumulation", "sum");
    expect(() => parseStoreFilters(p)).toThrow();
  });
  test("guest analysis only inherits period, with mobile purchasers as defaults", () => {
    const p = params();
    p.set("store", "invalid");
    p.set("status", "cancelled");
    p.set("menu", "invalid");
    const f = parseGuestFilters(p);
    expect(f.channel).toBe("mobile");
    expect(f.cohort).toBe("purchasers");
    expect(f.stay).toBe("closed");
    expect(parseGuestFilters(reportParams(f))).toEqual(f);
    p.set("cohort", "all");
    expect(() => parseGuestFilters(p)).toThrow();
    p.set("cohort", "registered");
    p.set("start", "2026-10-25T00:00:00Z");
    expect(() => parseGuestFilters(p)).toThrow();
  });
});
