import { ScheduledEvent } from "@/entities/event";
import { Temporal } from "temporal-polyfill-lite";

// 間も無く表示は15分前から
const STARTING_SOON_LEAD_MINUTES = 15;

type ScheduledEventPeriod = Pick<ScheduledEvent, "startAt" | "endAt">;

type EventStatus = "upcoming" | "startingSoon" | "ongoing" | "ended";

export function getEventStatus(
  event: ScheduledEventPeriod,
  now: Temporal.PlainDateTime,
): EventStatus {
  if (Temporal.PlainDateTime.compare(now, event.endAt) >= 0) {
    return "ended";
  }

  if (Temporal.PlainDateTime.compare(now, event.startAt) >= 0) {
    return "ongoing";
  }

  const startingSoonAt = event.startAt.subtract({
    minutes: STARTING_SOON_LEAD_MINUTES,
  });

  if (Temporal.PlainDateTime.compare(now, startingSoonAt) >= 0) {
    return "startingSoon";
  }

  return "upcoming";
}
