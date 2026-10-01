import { currentEventDates, ScheduledEvent } from "@/entities/event";
import { FestivalDay } from "@/entities/event";

/**
 * 指定した日のイベントを返す純粋関数
 * @param events
 * @param festivalDay
 * @returns
 */
export function selectEventsByFestivalDay(
  events: ScheduledEvent[],
  festivalDay: FestivalDay,
): ScheduledEvent[] {
  const festivalDate = currentEventDates[festivalDay];

  return events.filter((event) =>
    event.startAt.toPlainDate().equals(festivalDate),
  );
}
