import { ScheduledEvent } from "@/entities/event";
import { Temporal } from "@js-temporal/polyfill";

type ScheduledEventPeriod = Pick<ScheduledEvent, "startAt" | "endAt">;

export function shouldShowOngoingMask(
  event: ScheduledEventPeriod,
  now: Temporal.PlainDateTime,
): boolean {
  const hasStarted = Temporal.PlainDateTime.compare(event.startAt, now) <= 0;
  const hasNotEnded = Temporal.PlainDateTime.compare(now, event.endAt) < 0;

  return hasStarted && hasNotEnded;
}
