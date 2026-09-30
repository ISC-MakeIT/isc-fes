"use client";

import { trackEvent } from "@/shared/lib/analytics";
import { useEffect, useRef } from "react";

export function StoreViewAnalytics({
  storeId,
  floorNumber,
}: {
  storeId: string;
  floorNumber?: number;
}) {
  const lastTrackedStoreId = useRef<string | null>(null);
  useEffect(() => {
    if (lastTrackedStoreId.current === storeId) return;
    lastTrackedStoreId.current = storeId;
    trackEvent("view_store", {
      store_id: storeId,
      ...(floorNumber ? { floor_number: floorNumber } : {}),
    });
  }, [storeId, floorNumber]);

  return null;
}
