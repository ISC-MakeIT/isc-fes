import { Temporal } from "temporal-polyfill-lite";
import { FESTIVAL_DATES } from "@/shared/config";

export function isWithinFestivalPeriod(now: Temporal.PlainDateTime): boolean {
  const periodStartAt = FESTIVAL_DATES.day1.toPlainDateTime();
  const periodEndAt = FESTIVAL_DATES.day2.add({ days: 1 }).toPlainDateTime();

  return (
    Temporal.PlainDateTime.compare(now, periodStartAt) >= 0 &&
    Temporal.PlainDateTime.compare(now, periodEndAt) < 0
  );
}
