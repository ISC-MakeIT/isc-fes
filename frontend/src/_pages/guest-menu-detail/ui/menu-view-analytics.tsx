"use client";

import { trackEvent } from "@/shared/lib/analytics";
import { useEffect, useRef } from "react";

export function MenuViewAnalytics({
  storeId,
  menuId,
  unitPrice,
}: {
  storeId: string;
  menuId: string;
  unitPrice: number;
}) {
  const lastTrackedMenuId = useRef<string | null>(null);
  useEffect(() => {
    if (lastTrackedMenuId.current === menuId) return;
    lastTrackedMenuId.current = menuId;
    trackEvent("view_item", {
      currency: "JPY",
      value: unitPrice,
      store_id: storeId,
      items: [{ item_id: menuId, price: unitPrice, affiliation: storeId }],
    });
  }, [storeId, menuId, unitPrice]);

  return null;
}
