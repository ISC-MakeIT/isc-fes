import { EventDateKey, EventDateMap, ScheduledEvent } from "../model/types";

export function selectEventsByDateKey<const TEventDates extends EventDateMap>(
  events: readonly ScheduledEvent[],
  eventDates: TEventDates,
  dateKey: EventDateKey<TEventDates>,
): ScheduledEvent[] {
  const selectedDate = eventDates[dateKey];

  // NOTE:
  //   dateKeyは型レベルで制限されているが
  //   TSのnoUncheckedIndexedAccess = trueの設定により、参照結果にはundefinedを含む
  if (selectedDate === undefined) {
    throw new Error(`イベントの開催日が見つかりません：${dateKey}`);
  }

  return events.filter((event) =>
    event.startAt.toPlainDate().equals(selectedDate),
  );
}
