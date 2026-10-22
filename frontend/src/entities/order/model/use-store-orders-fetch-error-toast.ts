"use client";

import { toast } from "@/shared/ui/toast";
import { useEffect, useRef } from "react";

const STORE_ORDERS_ERROR_TOAST_ID = "store-orders-fetch-error";

export function useStoreOrdersFetchErrorToast(isError: boolean) {
  const hasNotifiedError = useRef(false);

  useEffect(() => {
    if (!isError) {
      hasNotifiedError.current = false;
      return;
    }

    if (hasNotifiedError.current) {
      return;
    }

    hasNotifiedError.current = true;
    toast.add({
      id: STORE_ORDERS_ERROR_TOAST_ID,
      type: "error",
      priority: "high",
      title: "注文情報を更新できませんでした",
      description:
        "表示内容が最新ではない可能性があります。通信環境を確認してください。",
    });
  }, [isError]);
}
