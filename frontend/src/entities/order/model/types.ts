import { v } from "@/shared/lib/valibot";

export enum OrderStatus {
  Pending = "pending",
  Ready = "ready",
  Completed = "completed",
  Cancelled = "cancelled",
}
export const OrderStatusSchema = v.enum(OrderStatus);

export const OrderItemTopping = v.object({
  toppingId: v.string(),
  toppingName: v.string(),
  unitPrice: v.number(),
});
export type OrderItemTopping = v.InferOutput<typeof OrderItemTopping>;

export const OrderItem = v.object({
  id: v.string(),
  menuId: v.string(),
  menuName: v.string(),
  unitPrice: v.number(),
  quantity: v.number(),
  toppings: v.array(OrderItemTopping),
});
export type OrderItem = v.InferOutput<typeof OrderItem>;

export const Order = v.object({
  id: v.string(),
  storeId: v.string(),
  status: OrderStatusSchema,
  totalAmount: v.number(),
  displayNumber: v.number(),
  version: v.number(),
  storeName: v.string(),
  roomName: v.string(),
  items: v.array(OrderItem),
});
export type Order = v.InferOutput<typeof Order>;
