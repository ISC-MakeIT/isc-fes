import { describe, expect, test } from "bun:test";
import { defaultFilters, inputToISO, jstInput, parseFilters, toParams } from "../src/lib/filters";
import { makeCSV } from "../src/lib/csv";

const defaults = defaultFilters("2026-10-24T01:00:00Z", "2026-10-24T08:00:00Z");
describe("query validation", () => {
  test("JST boundaries round-trip without the server timezone", () => {
    expect(jstInput(defaults.start)).toBe("2026-10-24T00:00");
    expect(jstInput(defaults.end)).toBe("2026-10-25T00:00");
    expect(inputToISO("2026-10-24T10:00")).toBe("2026-10-24T10:00:00+09:00");
    expect(parseFilters(toParams(defaults))).toEqual(defaults);
  });
  test("rejects invalid dates, timezone-free input, reversed or oversized periods", () => {
    for (const values of [
      { start: "2026-02-30T00:00:00+09:00" },
      { start: "2026-10-24T00:00:00" },
      { end: defaults.start },
      { end: "2028-10-24T00:00:00+09:00" },
      { start: "2026-10-24T99:99:00Z" },
    ])
      expect(() => parseFilters(toParams({ ...defaults, ...values }))).toThrow();
  });
  test("rejects SQL-shaped ids, unknown enums and excessive sample counts", () => {
    for (const values of [
      { store: "' OR true --" },
      { menu: "nope" },
      { interval: "1 minute" },
      { channel: "arbitrary" },
      { low: 8, high: 3 },
      { low: 1.5 },
      { end: "2026-11-24T00:00:00+09:00", interval: "5m" },
    ]) {
      const p = new URLSearchParams({
        ...Object.fromEntries(toParams(defaults)),
        ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])),
      });
      expect(() => parseFilters(p)).toThrow();
    }
  });
});
test("CSV preserves Japanese, quotes, newlines and protects formula-like labels", () => {
  expect(makeCSV([["店舗", '="x"', "a,b", "line\nbreak", null, -2]])).toBe(
    '\uFEFF"店舗","\'=""x""","a,b","line\nbreak","","-2"',
  );
});
