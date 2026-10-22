import { Temporal } from "temporal-polyfill-lite";

export const FESTIVAL_DATES = {
  day1: Temporal.PlainDate.from(
    {
      year: 2026,
      month: 10,
      day: 24,
    },
    {
      overflow: "reject",
    },
  ),
  day2: Temporal.PlainDate.from(
    {
      year: 2026,
      month: 10,
      day: 25,
    },
    {
      overflow: "reject",
    },
  ),
} as const;
