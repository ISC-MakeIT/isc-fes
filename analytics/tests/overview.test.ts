import { describe, expect, test } from "bun:test";
import { overviewDefaults, parseOverviewFilters } from "../src/lib/overview";
import { reportParams } from "../src/lib/report-filters";
import type { Metadata } from "../src/lib/types";

describe("Overall report conditions", () => {
  test("only period, interval and revenue basis are inherited; hidden store/channel/status filters cannot narrow totals", () => {
    const base = overviewDefaults({
      firstOrder: "2026-10-24T10:00:00+09:00",
      lastOrder: "2026-10-25T10:00:00+09:00",
    } as Metadata);
    const params = reportParams(base);
    for (const [key, value] of Object.entries({
      store: "invalid",
      storeIds: "invalid",
      menu: "invalid",
      channel: "face",
      status: "cancelled",
      accumulation: "interval",
    }))
      params.set(key, value);
    expect(parseOverviewFilters(params)).toEqual(base);
    expect(base.start).toBe("2026-10-24T00:00:00+09:00");
    expect(base.sales).toBe("completed");
    params.set("sales", "accepted");
    expect(parseOverviewFilters(params).sales).toBe("accepted");
    params.set("sales", "invalid");
    expect(() => parseOverviewFilters(params)).toThrow();
    params.set("sales", "all");
    params.set("end", base.start);
    expect(() => parseOverviewFilters(params)).toThrow();
  });
});
