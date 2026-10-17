"use client";

import { currentScheduledEvents } from "@/entities/event";
import {
  EVENT_IMAGE_ASPECT,
  eventsUrl,
  FESTIVAL_TIME_ZONE,
} from "@/shared/config";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { Temporal } from "temporal-polyfill-lite";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getEventStatus } from "../lib/get-event-status";
import { DotText } from "@/shared/ui/dot-text";

const TIME_UPDATE_INTERVAL_MS = 30_000;

type EventBannersProps = {
  initialDateTime: string;
};

export function EventBanners({ initialDateTime }: EventBannersProps) {
  const [currentDateTime, setCurrentDateTime] =
    useState<Temporal.PlainDateTime>(() =>
      Temporal.PlainDateTime.from(initialDateTime),
    );

  const bannerRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  // 初期描画時、開催中のバナーにスクロールを合わせる
  useEffect(() => {
    const now = Temporal.Now.plainDateTimeISO(FESTIVAL_TIME_ZONE);

    setCurrentDateTime(now);

    const ongoingEventIndex = currentScheduledEvents.findIndex(
      (event) => getEventStatus(event, now) === "ongoing",
    );

    const targetEventIndex =
      ongoingEventIndex >= 0
        ? ongoingEventIndex
        : currentScheduledEvents.findIndex(
            (event) => getEventStatus(event, now) === "startingSoon",
          );

    if (targetEventIndex >= 0) {
      bannerRefs.current[ongoingEventIndex]?.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: "center",
      });
    }

    const intervalId = setInterval(() => {
      setCurrentDateTime(Temporal.Now.plainDateTimeISO(FESTIVAL_TIME_ZONE));
    }, TIME_UPDATE_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="flex flex-row gap-6 overflow-x-auto px-4 py-4">
      {currentScheduledEvents.map((event, index) => {
        const status = getEventStatus(event, currentDateTime);
        const isStartingSoon = status === "startingSoon";
        const isOngoing = status === "ongoing";

        return (
          <Link
            ref={(element) => {
              bannerRefs.current[index] = element;
            }}
            key={event.name}
            href={eventsUrl(event.name)}
            className="relative block w-84"
          >
            <AspectRatioImage
              ratio={EVENT_IMAGE_ASPECT}
              alt={`${event.name}のバナー画像`}
              src={event.bannerSrc}
              className="w-84"
            />

            {isOngoing && (
              <>
                <span
                  aria-hidden
                  className="border-primary absolute inset-0 border-[0.3125rem]"
                />
                <DotText className="bg-primary text-secondary-foreground absolute right-0 bottom-0 rounded-sm px-2 py-1 text-lg">
                  開催中
                </DotText>
              </>
            )}

            {isStartingSoon && (
              <DotText className="bg-secondary text-secondary-foreground absolute right-0 bottom-0 rounded-sm px-2 py-1 text-lg">
                まもなく
              </DotText>
            )}
          </Link>
        );
      })}
    </div>
  );
}
