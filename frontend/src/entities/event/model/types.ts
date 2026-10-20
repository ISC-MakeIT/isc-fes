import { Temporal } from "temporal-polyfill-lite";
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
  bannerSrc: StaticImageData | undefined;
  description: string;
  room: "8Fステージ" | "707教室" | "7階ホール" | "608教室";
  startAt: Temporal.PlainDateTime;
  endAt: Temporal.PlainDateTime;
};
