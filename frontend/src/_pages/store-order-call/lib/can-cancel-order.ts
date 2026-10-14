import { Order, OrderStatus } from "@/entities/order";
import { Temporal } from "temporal-polyfill-lite";

const ORDER_CANCELLATION_DELAY = { minutes: 15 };

export function canCancelOrder(
  order: Pick<Order, "status" | "readyAt">,
  now: Temporal.Instant,
): boolean {
  if (order.status !== OrderStatus.Ready || order.readyAt === null) {
    return false;
  }

  const readyAt = Temporal.Instant.fromEpochMilliseconds(
    order.readyAt.getTime(),
  );

  const cancellationAllowedAt = readyAt.add(ORDER_CANCELLATION_DELAY);

  return Temporal.Instant.compare(now, cancellationAllowedAt) >= 0;
}
