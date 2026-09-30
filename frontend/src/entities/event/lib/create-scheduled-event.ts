import { Temporal } from "@js-temporal/polyfill";

import type { ScheduledEvent } from "../model/types";

type EventTimeFields = {
  hour: number;
  minute?: number;
};

type ScheduledEventInput = Omit<ScheduledEvent, "startAt" | "endAt"> & {
  date: Temporal.PlainDate;
  startTime: EventTimeFields;
  endTime: EventTimeFields;
};

function createEventTime({
  hour,
  minute = 0,
}: EventTimeFields): Temporal.PlainTime {
  return Temporal.PlainTime.from(
    {
      hour,
      minute,
    },
    { overflow: "reject" },
  );
}

export function createScheduledEvent({
  date,
  startTime,
  endTime,
  ...event
}: ScheduledEventInput): ScheduledEvent {
  return {
    ...event,
    startAt: date.toPlainDateTime(createEventTime(startTime)),
    endAt: date.toPlainDateTime(createEventTime(endTime)),
  };
}
