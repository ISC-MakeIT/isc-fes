import {
  currentEventDates,
  currentScheduledEvents,
  FestivalDay,
  ScheduledEvent,
} from "@/entities/event";
import { Card } from "@/shared/ui/card";
import { HeadingCard } from "@/shared/ui/heading-card";
import { Temporal } from "temporal-polyfill-lite";
import { selectEventsByFestivalDay } from "../lib/select-events-by-festival-day";
import { cn } from "@/shared/lib/utils";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { EVENT_IMAGE_ASPECT } from "@/shared/config";

export function EventScheduleView() {
  const day1Events = selectEventsByFestivalDay(
    currentScheduledEvents,
    FestivalDay.Day1,
  );

  const day2Events = selectEventsByFestivalDay(
    currentScheduledEvents,
    FestivalDay.Day2,
  );

  const cardStyle =
    "rounded-full text-[1.375rem] font-bold text-secondary-foreground px-6 py-2 w-full";

  function formatDate(date: Temporal.PlainDate): string {
    return `${date.month}月${date.day}日`;
  }
  return (
    <div className="mx-auto max-w-220">
      <HeadingCard className="m-8 px-14 py-4">イベントスケジュール</HeadingCard>
      <div className="mx-8 flex flex-col gap-16 md:flex-row md:gap-6">
        <section className="w-full space-y-4 pb-16">
          <Card className={cn(cardStyle, "bg-secondary")}>
            {formatDate(currentEventDates.day1)}
          </Card>
          <ul className="space-y-4 px-2">
            {day1Events.map((event) => (
              <EventScheduleItem isDay1 event={event} key={event.slug} />
            ))}
          </ul>
        </section>
        <section className="w-full space-y-4 pb-16">
          <Card className={cn(cardStyle, "bg-tertiary")}>
            {formatDate(currentEventDates.day2)}
          </Card>
          <ul className="space-y-4 px-2">
            {day2Events.map((event) => (
              <EventScheduleItem
                isDay1={false}
                event={event}
                key={event.slug}
              />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

type EventScheduleItemProps = {
  event: ScheduledEvent;
  isDay1: boolean;
};

function EventScheduleItem({ event, isDay1 }: EventScheduleItemProps) {
  return (
    <li className="list-none" id={event.slug}>
      <div className="flex flex-row items-center gap-2 text-xl font-semibold">
        <span aria-hidden className="bg-primary size-5 rounded-full" />
        <time dateTime={event.startAt.toString()}>
          {formatEventTime(event.startAt)}
        </time>
        <span>〜</span>
        <time dateTime={event.endAt.toString()}>
          {formatEventTime(event.endAt)}
        </time>
      </div>

      <div className="grid grid-cols-[5.4375rem_minmax(0,1fr)]">
        <span aria-hidden className="bg-foreground mx-auto w-0.5" />
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-bold">{event.name}</h2>
          <AspectRatioImage
            alt={`${event.name}のバナー画像`}
            ratio={EVENT_IMAGE_ASPECT}
            className={cn(
              "shadow-[4px_4px_0]",
              isDay1 ? "shadow-secondary" : "shadow-tertiary",
            )}
            src={event.bannerPath}
          />
          <p>{event.description}</p>
        </div>
      </div>
    </li>
  );
}

function formatEventTime(dateTime: Temporal.PlainDateTime): string {
  return dateTime.toPlainTime().toString({ smallestUnit: "minute" });
}
