import { defaultFilters, InputError, parseFilters } from "./filters";
import type { GuestFilters, Metadata, StoreFilters } from "./types";

export function reportParams(filters: object): URLSearchParams {
  return new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]));
}
export function parseStoreFilters(params: URLSearchParams): StoreFilters {
  const base = parseFilters(params);
  const storeIds = [...new Set((params.get("storeIds") ?? base.store).split(",").filter(Boolean))];
  if (
    storeIds.length > 30 ||
    storeIds.some((id) => !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))
  )
    throw new InputError("比較する店舗は有効なIDで30店舗以内にしてください。");
  const accumulation = params.get("accumulation") ?? "interval";
  if (accumulation !== "interval" && accumulation !== "cumulative")
    throw new InputError("グラフの集計方法が不正です。");
  return { ...base, store: "", storeIds, accumulation };
}
export function storeDefaults(meta: Metadata): StoreFilters {
  const base = defaultFilters(meta.firstOrder, meta.lastOrder);
  return {
    ...base,
    interval: base.interval === "30m" ? "15m" : base.interval,
    storeIds: [],
    accumulation: "interval",
  };
}
export function parseGuestFilters(params: URLSearchParams): GuestFilters {
  // Guest reports intentionally do not inherit store/menu/status conditions.
  const shared = new URLSearchParams({
    start: params.get("start") ?? "",
    end: params.get("end") ?? "",
    interval: params.get("interval") ?? "15m",
  });
  const base = parseFilters(shared);
  const choice = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    const value = params.get(key) ?? fallback;
    if (!values.includes(value as T)) throw new InputError(`${key} の値が不正です。`);
    return value as T;
  };
  return {
    start: base.start,
    end: base.end,
    interval: base.interval,
    channel: choice("channel", ["all", "mobile", "face"], "mobile"),
    cohort: choice("cohort", ["purchasers", "registered"], "purchasers"),
    cumulative: choice("cumulative", ["total", "period"], "total"),
    stay: choice("stay", ["closed", "observed"], "closed"),
  };
}
export function guestDefaults(meta: Metadata): GuestFilters {
  const base = defaultFilters(meta.firstGuest ?? meta.firstOrder, meta.lastGuest ?? meta.lastOrder);
  return parseGuestFilters(
    reportParams({
      ...base,
      channel: "mobile",
      interval: base.interval === "30m" ? "15m" : base.interval,
    }),
  );
}
