import { Temporal } from "temporal-polyfill";

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
    name: "テストイベント1",
    bannerPath: undefined,
    description: "テストイベント1の説明",
    date: currentEventDates.day1,
    startTime: {
      hour: 10,
    },
    endTime: {
      hour: 11,
    },
  }),
  createScheduledEvent({
    name: "テストイベント2",
    bannerPath: undefined,
    description: "テストイベント2の説明",
    date: currentEventDates.day1,
    startTime: {
      hour: 12,
    },
    endTime: {
      hour: 13,
    },
  }),
  createScheduledEvent({
    name: "テストイベント3",
    bannerPath: undefined,
    description: "テストイベント3の説明",
    date: currentEventDates.day2,
    startTime: {
      hour: 15,
    },
    endTime: {
      hour: 16,
    },
  }),
  createScheduledEvent({
    name: "テストイベント4",
    bannerPath: undefined,
    description: "テストイベント4の説明",
    date: currentEventDates.day2,
    startTime: {
      hour: 12,
    },
    endTime: {
      hour: 13,
    },
  }),
  createScheduledEvent({
    name: "テストイベント5",
    bannerPath: undefined,
    description: "テストイベント5の説明",
    date: currentEventDates.day2,
    startTime: {
      hour: 13,
    },
    endTime: {
      hour: 14,
    },
  }),
] satisfies ScheduledEvent[];
