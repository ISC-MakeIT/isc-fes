import { Temporal } from "@js-temporal/polyfill";
import { StaticImageData } from "next/image";

export type ScheduledEvent = {
  name: string;
  bannerPath: StaticImageData | undefined;
  description: string;
  startAt: Temporal.PlainDateTime;
  endAt: Temporal.PlainDateTime;
};

export type EventDateMap = Record<string, Temporal.PlainDate>;

export type EventDateKey<TEventDates extends EventDateMap> = Extract<
  keyof TEventDates,
  string
>;
