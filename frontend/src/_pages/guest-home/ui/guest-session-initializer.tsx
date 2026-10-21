"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ensureGuest } from "../api/ensure-guest";
import { getOrCreateVisitorId } from "../lib/get-or-create-visitor-id";

export function GuestSessionInitializer() {
  useEffect(() => {
    const visitorId = getOrCreateVisitorId();
    Sentry.setUser({ id: `visitor:${visitorId}` });

    ensureGuest().catch((error) => {
      // カート更新時にも発行されるため、ホームでの失敗は操作を妨げない。
      Sentry.captureException(error);
    });
  }, []);

  return null;
}
