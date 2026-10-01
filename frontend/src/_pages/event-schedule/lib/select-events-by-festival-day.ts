import { currentEventDates, ScheduledEvent } from "@/entities/event";
import { FestivalDay } from "@/entities/event";
import { Temporal } from "temporal-polyfill";

/**
 * 指定した日のイベントを返す純粋関数。イベントの開始時刻が早い順にソートもする
 * @param events
 * @param festivalDay
 * @returns
 */
export function selectEventsByFestivalDay(
  events: ScheduledEvent[],
  festivalDay: FestivalDay,
): ScheduledEvent[] {
  const festivalDate = currentEventDates[festivalDay];

  return events
    .filter((event) => event.startAt.toPlainDate().equals(festivalDate))
    .sort((eventA, eventB) =>
      Temporal.PlainDateTime.compare(eventA.startAt, eventB.startAt),
    );
}
