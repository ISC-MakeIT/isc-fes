"use client";

import { currentScheduledEvents, type ScheduledEvent } from "@/entities/event";
import { eventsUrl, FESTIVAL_TIME_ZONE } from "@/shared/config";
import { cn } from "@/shared/lib/utils";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { DotText } from "@/shared/ui/dot-text";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Temporal } from "temporal-polyfill-lite";
import { selectDisplayEvents } from "../lib/select-display-events";

export function DisplayEvents({
  initialDateTime,
}: {
  initialDateTime: string;
}) {
  const [now, setNow] = useState(() =>
    Temporal.PlainDateTime.from(initialDateTime),
  );

  useEffect(() => {
    const updateTime = () =>
      setNow(Temporal.Now.plainDateTimeISO(FESTIVAL_TIME_ZONE));
    updateTime();
    const interval = setInterval(updateTime, 30_000);
    return () => clearInterval(interval);
  }, []);

  const { current, next } = selectDisplayEvents(currentScheduledEvents, now);

  return (
    <section
      aria-label="イベント案内"
      className="border-primary w-full overflow-hidden rounded-sm border-4"
    >
      <div
        aria-hidden
        className="bg-primary -mx-1 -mt-1 flex h-[33px] items-center overflow-hidden whitespace-nowrap text-white"
      >
        <DotText className="text-xl leading-none">
          EVENT EVENT EVENT EVENT EVENT EVENT EVENT
        </DotText>
      </div>
      <div className="flex items-end gap-6 p-4">
        <EventPreview event={current} current />
        <EventPreview event={next} current={false} />
      </div>
    </section>
  );
}

function EventPreview({
  event,
  current,
}: {
  event: ScheduledEvent | undefined;
  current: boolean;
}) {
  const content = (
    <>
      {event ? (
        <AspectRatioImage
          src={event.bannerSrc}
          alt={event.name}
          ratio={169.12 / 112}
          sizes={current ? "200px" : "90px"}
        />
      ) : (
        <div className="bg-muted flex aspect-[169.12/112] items-center justify-center px-2 text-center text-sm">
          {current ? (
            <>
              開催中の
              <br />
              イベントはありません
            </>
          ) : (
            <>
              次のイベントは
              <br />
              ありません
            </>
          )}
        </div>
      )}
      {(event || !current) && (
        <span
          className={cn(
            "bg-primary absolute right-0 bottom-0 text-white",
            current
              ? "rounded-sm px-4 py-2 text-xl"
              : "translate-y-full px-4 py-1 text-base",
          )}
        >
          {current ? "開催中" : "NEXT"}
        </span>
      )}
    </>
  );

  const className = cn(
    "relative block",
    current
      ? "border-primary flex-1 overflow-hidden rounded-sm border-[5px]"
      : "mb-[27px] w-22.5 shrink-0",
  );

  return event ? (
    <Link href={eventsUrl(event.name)} title={event.name} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
