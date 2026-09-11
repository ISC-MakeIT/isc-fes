import { v } from "@/shared/lib/valibot";

export enum OrderStatus {
  Placed = "placed",
  Cooked = "cooked",
  PickedUp = "pickedUp",
}
const OrderStatusSchema = v.enum(OrderStatus);

const OrderItemTopping = v.object({
  id: v.string(),
  name: v.string(),
});

const OrderItem = v.object({
  id: v.string(),
  name: v.string(),
  toppings: v.array(OrderItemTopping),
});

export const Order = v.object({
  id: v.string(),
  storeId: v.string(),
  status: OrderStatusSchema,
  items: v.array(OrderItem),
});
export type Order = v.InferOutput<typeof Order>;
