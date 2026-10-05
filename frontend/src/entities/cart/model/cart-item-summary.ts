import { CartItem } from "./types";

export type CartItemSummary = {
  item: Pick<
    CartItem,
    "id" | "menuId" | "name" | "imageUrl" | "unitPrice" | "toppings"
  >;
  quantity: number;
};
