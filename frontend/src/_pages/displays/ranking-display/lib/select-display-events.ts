import type { ScheduledEvent } from "@/entities/event";
import { Temporal } from "temporal-polyfill-lite";

export function selectDisplayEvents(
  events: readonly ScheduledEvent[],
  now: Temporal.PlainDateTime,
) {
  const chronologicalEvents = [...events].sort((left, right) =>
    Temporal.PlainDateTime.compare(left.startAt, right.startAt),
  );

  return {
    current: chronologicalEvents.find(
      (event) =>
        Temporal.PlainDateTime.compare(event.startAt, now) <= 0 &&
        Temporal.PlainDateTime.compare(now, event.endAt) < 0,
    ),
    next: chronologicalEvents.find(
      (event) => Temporal.PlainDateTime.compare(now, event.startAt) < 0,
    ),
  };
}
