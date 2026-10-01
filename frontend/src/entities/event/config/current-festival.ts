import { Temporal } from "@js-temporal/polyfill";

import { createScheduledEvent } from "../lib/create-scheduled-event";
import type { FestivalDates, ScheduledEvent } from "../model/types";

export const currentEventDates = {
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
} as const satisfies FestivalDates;

export const currentScheduledEvents = [
  createScheduledEvent({
    name: "男女装",
    bannerPath: undefined,
    description: "男女装の説明",
    date: currentEventDates.day1,
    startTime: {
      hour: 10,
    },
    endTime: {
      hour: 11,
    },
  }),
  createScheduledEvent({
    name: "カラオケ",
    bannerPath: undefined,
    description: "カラオケの説明",
    date: currentEventDates.day1,
    startTime: {
      hour: 12,
    },
    endTime: {
      hour: 13,
    },
  }),
  createScheduledEvent({
    name: "筋肉サークル",
    bannerPath: undefined,
    description: "説明",
    date: currentEventDates.day2,
    startTime: {
      hour: 15,
    },
    endTime: {
      hour: 16,
    },
  }),
  createScheduledEvent({
    name: "フリージア",
    bannerPath: undefined,
    description: "説明",
    date: currentEventDates.day2,
    startTime: {
      hour: 12,
    },
    endTime: {
      hour: 13,
    },
  }),
  createScheduledEvent({
    name: "演奏技術探求サークル",
    bannerPath: undefined,
    description: "説明",
    date: currentEventDates.day2,
    startTime: {
      hour: 13,
    },
    endTime: {
      hour: 14,
    },
  }),
] satisfies ScheduledEvent[];
