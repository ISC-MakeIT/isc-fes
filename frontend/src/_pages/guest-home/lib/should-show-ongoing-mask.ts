import { ScheduledEvent } from "@/entities/event";
import { Temporal } from "temporal-polyfill-lite";

// 開催に間に合うように実際の開催の5分前に開催中表示にする
const ONGOING_LEAD_MINUTES = 5;

type ScheduledEventPeriod = Pick<ScheduledEvent, "startAt" | "endAt">;

export function shouldShowOngoingMask(
  event: ScheduledEventPeriod,
  now: Temporal.PlainDateTime,
): boolean {
  const ongoingStartsAt = event.startAt.subtract({
    minutes: ONGOING_LEAD_MINUTES,
  });

  const hasStarted = Temporal.PlainDateTime.compare(ongoingStartsAt, now) <= 0;
  const hasNotEnded = Temporal.PlainDateTime.compare(now, event.endAt) < 0;

  return hasStarted && hasNotEnded;
}
