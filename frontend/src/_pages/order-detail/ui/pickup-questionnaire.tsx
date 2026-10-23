"use client";

import { OrderStatus } from "@/entities/order";
import {
  QuestionnaireTrigger,
  useAppQuestionnaire,
} from "@/widgets/app-questionnaire";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { fetchOrderByidQueryOptions } from "../api/fetch-order-by-id";

type PickupQuestionnaireProps = {
  orderId: string;
};

export function PickupQuestionnaire({ orderId }: PickupQuestionnaireProps) {
  const { data: order } = useSuspenseQuery(fetchOrderByidQueryOptions(orderId));
  const { requestQuestionnaire } = useAppQuestionnaire();
  const previousOrder = useRef(order);

  useEffect(() => {
    const previous = previousOrder.current;
    previousOrder.current = order;

    // 受け取り済みの注文を開き直した場合は抽選しない。
    if (
      previous?.id === order?.id &&
      (previous?.status === OrderStatus.Pending ||
        previous?.status === OrderStatus.Ready) &&
      order?.status === OrderStatus.Completed
    ) {
      requestQuestionnaire(QuestionnaireTrigger.PickupCompleted);
    }
  }, [order, requestQuestionnaire]);

  return null;
}
