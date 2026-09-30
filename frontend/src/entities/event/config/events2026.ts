import { Temporal } from "@js-temporal/polyfill";

import { createScheduledEvent } from "../lib/create-scheduled-event";
import type {
  EventDateKey,
  EventDateMap,
  ScheduledEvent,
} from "../model/types";

export const eventDates2026 = {
  october24: Temporal.PlainDate.from(
    {
      year: 2026,
      month: 10,
      day: 24,
    },
    {
      overflow: "reject",
    },
  ),
  october25: Temporal.PlainDate.from(
    {
      year: 2026,
      month: 10,
      day: 25,
    },
    {
      overflow: "reject",
    },
  ),
} as const satisfies EventDateMap;

export type EventDateKey2026 = EventDateKey<typeof eventDates2026>;

export const events2026 = [
  createScheduledEvent({
    name: "男女装",
    bannerPath: undefined,
    description: "男女装の説明",
    date: eventDates2026.october24,
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
    date: eventDates2026.october24,
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
    date: eventDates2026.october24,
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
    date: eventDates2026.october25,
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
    date: eventDates2026.october25,
    startTime: {
      hour: 13,
    },
    endTime: {
      hour: 14,
    },
  }),
] satisfies ScheduledEvent[];
