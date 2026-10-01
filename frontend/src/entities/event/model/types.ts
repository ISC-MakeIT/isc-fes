import { Temporal } from "@js-temporal/polyfill";
import { StaticImageData } from "next/image";

export enum FestivalDay {
  Day1 = "day1",
  Day2 = "day2",
}

export type FestivalDates = {
  [FestivalDay.Day1]: Temporal.PlainDate;
  [FestivalDay.Day2]: Temporal.PlainDate;
};

export type ScheduledEvent = {
  name: string;
  bannerPath: StaticImageData | undefined;
  description: string;
  startAt: Temporal.PlainDateTime;
  endAt: Temporal.PlainDateTime;
};
