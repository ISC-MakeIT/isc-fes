import { Temporal } from "@js-temporal/polyfill";
import { StaticImageData } from "next/image";

export const FESTIVAL_DAY_KEYS = ["day1", "day2"] as const;

export type FestivalDayKey = (typeof FESTIVAL_DAY_KEYS)[number];

export type FestivalDates = Record<FestivalDayKey, Temporal.PlainDate>;

export type ScheduledEvent = {
  name: string;
  bannerPath: StaticImageData | undefined;
  description: string;
  startAt: Temporal.PlainDateTime;
  endAt: Temporal.PlainDateTime;
};

export type FestivalSchedule = {
  dates: FestivalDates;
  events: readonly ScheduledEvent[];
};
