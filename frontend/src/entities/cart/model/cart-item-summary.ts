import { CartItem } from "./types";

export type CartItemSummary = {
  item: Pick<
    CartItem,
    "menuId" | "name" | "imageUrl" | "unitPrice" | "toppings"
  >;
  quantity: number;
};
