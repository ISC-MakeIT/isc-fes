import { Temporal } from "temporal-polyfill-lite";

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
    slug: "test1",
    name: "テストイベント1",
    bannerSrc: undefined,
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
    slug: "test2",
    name: "テストイベント2",
    bannerSrc: undefined,
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
    slug: "test3",
    name: "テストイベント3",
    bannerSrc: undefined,
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
    slug: "test4",
    name: "テストイベント4",
    bannerSrc: undefined,
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
    slug: "test5",
    name: "テストイベント5",
    bannerSrc: undefined,
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
