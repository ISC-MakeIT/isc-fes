import { CartItem, summarizeCartItems, UpdateCartInput } from "@/entities/cart";

export function toCartUpdateItems(items: CartItem[]): UpdateCartInput["items"] {
  return summarizeCartItems(items).map(({ item, quantity }) => ({
    id: item.id,
    menuId: item.menuId,
    quantity,
    toppingIds: item.toppings.map((topping) => topping.toppingId),
  }));
}
