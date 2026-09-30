import { FestivalDay, FestivalSchedule, ScheduledEvent } from "../model/types";

/**
 * 指定した開催日のイベントを返す純粋関数
 * @param schedule
 * @param dayKey
 * @returns
 */
export function selectEventsByFestivalDay(
  schedule: FestivalSchedule,
  dayKey: FestivalDay,
): ScheduledEvent[] {
  const selectedDate = schedule.dates[dayKey];
  return schedule.events.filter((event) =>
    event.startAt.toPlainDate().equals(selectedDate),
  );
}
