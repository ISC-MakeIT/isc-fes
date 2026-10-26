import { intervals, type Filters } from "./types";

export class InputError extends Error {}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const milliseconds = {
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "1d": 86_400_000,
};

export function parseFilters(params: URLSearchParams): Filters {
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";
  // A timezone is mandatory; never depend on the host's timezone.
  const zoned = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
  const validDate = (value: string) => {
    if (!zoned.test(value) || !Number.isFinite(Date.parse(value))) return false;
    const date = value.slice(0, 10);
    return new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  };
  if (!validDate(start) || !validDate(end))
    throw new InputError("開始・終了日時をタイムゾーン付きで指定してください。");
  const duration = Date.parse(end) - Date.parse(start);
  if (duration <= 0 || duration > 366 * 86_400_000)
    throw new InputError("期間は開始より後、366日以内で指定してください。");
  const choice = <T extends string>(name: string, allowed: readonly T[], fallback: T): T => {
    const value = params.get(name) ?? fallback;
    if (!allowed.includes(value as T)) throw new InputError(`${name} の値が不正です。`);
    return value as T;
  };
  const interval = choice("interval", Object.keys(intervals) as (keyof typeof intervals)[], "30m");
  // Allow for a partially intersecting bucket at each end.
  if (Math.ceil(duration / milliseconds[interval]) + 1 > 2000)
    throw new InputError("集計点が多すぎます。集計単位を大きくしてください（最大2,000点）。");
  const id = (name: string) => {
    const value = params.get(name) ?? "";
    if (value && !uuid.test(value)) throw new InputError(`${name} のIDが不正です。`);
    return value;
  };
  const integer = (name: string, fallback: number) => {
    const value = params.get(name) ?? String(fallback);
    if (!/^\d+$/.test(value) || Number(value) > 10000)
      throw new InputError("混雑度のしきい値は0〜10,000の整数で指定してください。");
    return Number(value);
  };
  const low = integer("low", 3),
    high = integer("high", 8);
  if (low >= high) throw new InputError("混雑度の中しきい値は、高しきい値より小さくしてください。");
  return {
    start,
    end,
    interval,
    store: id("store"),
    menu: id("menu"),
    status: choice("status", ["all", "pending", "ready", "completed", "cancelled"], "all"),
    channel: choice("channel", ["all", "mobile", "face"], "all"),
    sales: choice("sales", ["completed", "accepted", "all"], "completed"),
    congestionMetric: choice("congestionMetric", ["preparing", "active", "arrivals"], "preparing"),
    low,
    high,
  };
}

export function toParams(filters: Filters): URLSearchParams {
  return new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]));
}
export function jstInput(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(0, 16);
}
export function jstTimestamp(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 3_600_000)
    .toISOString()
    .slice(0, 23)
    .replace("T", " ")
    .replace(/:00\.000$/, "")
    .replace(/\.000$/, "");
}
export function inputToISO(value: string): string {
  return `${value}:00+09:00`;
}
export function defaultFilters(first: string | null, last: string | null): Filters {
  let day = first
    ? jstInput(first).slice(0, 10)
    : new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
  const lastDay = last ? jstInput(last).slice(0, 10) : day;
  const endDay = new Date(Date.parse(`${lastDay}T00:00:00+09:00`) + 86_400_000).toISOString();
  if (Date.parse(endDay) - Date.parse(`${day}T00:00:00+09:00`) > 366 * 86_400_000)
    day = jstInput(new Date(Date.parse(endDay) - 366 * 86_400_000).toISOString()).slice(0, 10);
  const days = (Date.parse(endDay) - Date.parse(`${day}T00:00:00+09:00`)) / 86_400_000;
  return {
    start: `${day}T00:00:00+09:00`,
    end: endDay,
    interval: days > 30 ? "1d" : days > 7 ? "1h" : "30m",
    store: "",
    menu: "",
    status: "all",
    channel: "all",
    sales: "completed",
    congestionMetric: "preparing",
    low: 3,
    high: 8,
  };
}
