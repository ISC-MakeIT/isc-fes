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
import { shouldShowOngoingMask } from "../lib/should-show-ongoing-mask";
import { DotText } from "@/shared/ui/dot-text";

const TIME_UPDATE_INTERVAL_MS = 30_000;

export function EventBanners() {
  // サーバー描画からHydrationまでの間に開始時刻、終了時刻を跨ぐと開催中のマスク有無が変わってHydration Mismatchになるので初期化を遅延させる
  const [currentDateTime, setCurrentDateTime] =
    useState<Temporal.PlainDateTime | null>(null);

  const bannerRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  // 時刻の初期化と定期更新
  useEffect(() => {
    setCurrentDateTime(Temporal.Now.plainDateTimeISO(FESTIVAL_TIME_ZONE));

    const intervalId = setInterval(() => {
      setCurrentDateTime(Temporal.Now.plainDateTimeISO(FESTIVAL_TIME_ZONE));
    }, TIME_UPDATE_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const hasHandledInitialScrollRef = useRef(false);

  // 初期描画時、開催中のバナーにスクロールを合わせる
  useEffect(() => {
    if (!currentDateTime || hasHandledInitialScrollRef.current) return;

    hasHandledInitialScrollRef.current = true;

    const ongoingEventIndex = currentScheduledEvents.findIndex((event) =>
      shouldShowOngoingMask(event, currentDateTime),
    );

    bannerRefs.current[ongoingEventIndex]?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "center",
    });
  }, [currentDateTime]);

  return (
    <div className="flex flex-row gap-6 overflow-x-auto px-4 py-4">
      {currentScheduledEvents.map((event, index) => {
        const isOngoing =
          currentDateTime && shouldShowOngoingMask(event, currentDateTime);

        return (
          <Link
            ref={(element) => {
              bannerRefs.current[index] = element;
            }}
            key={event.name}
            href={eventsUrl()}
            className="relative block w-84"
          >
            <AspectRatioImage
              ratio={EVENT_IMAGE_ASPECT}
              alt={`${event.name}のバナー画像`}
              src={event.bannerPath}
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
          </Link>
        );
      })}
    </div>
  );
}
