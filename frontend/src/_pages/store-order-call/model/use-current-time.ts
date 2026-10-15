"use client";

import { useEffect, useState } from "react";
import { Temporal } from "temporal-polyfill-lite";

const CLOCK_UPDATE_INTERVAL_MS = 1_000;

export function useCurrentTime(): Temporal.Instant | null {
  const [now, setNow] = useState<Temporal.Instant | null>(null);

  useEffect(() => {
    setNow(Temporal.Now.instant());

    const intervalId = setInterval(() => {
      setNow(Temporal.Now.instant());
    }, CLOCK_UPDATE_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return now;
}
