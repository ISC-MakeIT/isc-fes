import { CartItem } from "./types";

export type CartItemSummary = {
  identityKey: string;
  item: Pick<
    CartItem,
    "id" | "menuId" | "name" | "imageUrl" | "unitPrice" | "toppings"
  >;
  quantity: number;
};
