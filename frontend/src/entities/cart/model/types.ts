import { v } from "@/shared/lib/valibot";
import { boolean } from "valibot";

export const CartItemTopping = v.object({
  id: v.string(),
  cartItemId: v.string(),
  toppingId: v.string(),
  name: v.string(),
  unitPrice: v.number(),
  available: v.boolean(),
});
export type CartItemTopping = v.InferOutput<typeof CartItemTopping>;

export const CartItemQuantity = v.pipe(
  v.number(),
  v.minValue(1),
  v.maxValue(99),
);
export type CartItemQuantity = v.InferOutput<typeof CartItemQuantity>;

export const CartItem = v.object({
  id: v.string(),
  menuId: v.string(),
  name: v.string(),
  imageUrl: v.string(),
  available: v.boolean(),
  quantity: v.number(),
  unitPrice: v.number(),
  toppings: v.array(CartItemTopping),
});
export type CartItem = v.InferOutput<typeof CartItem>;

export const Cart = v.object({
  storeId: v.string(),
  version: v.number(),
  totalAmount: v.number(),
  canCheckout: boolean(),
  items: v.array(CartItem),
});
export type Cart = v.InferOutput<typeof Cart>;
