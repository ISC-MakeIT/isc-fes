import { eventDates, FestivalDay } from "@/entities/event";
import { Card } from "@/shared/ui/card";
import { HeadingCard } from "@/shared/ui/heading-card";
import { Temporal } from "@js-temporal/polyfill";
import { selectEventsByFestivalDay } from "../lib/select-events-by-festival-day";

export function EventScheduleView() {
  const day1Events = selectEventsByFestivalDay();

  const cardStyle = "bg-secondary rounded-full text-[1.375rem] font-bold";

  function formatDate(date: Temporal.PlainDate): string {
    return `${date.month}月${date.day}日`;
  }
  return (
    <div>
      <HeadingCard className="px-14 py-4">イベントスケジュール</HeadingCard>
      <Card className={cardStyle}>
        {formatDate(eventDates[FestivalDay.Day1])}
      </Card>
    </div>
  );
}
