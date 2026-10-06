import { Cart, UpdateCartInput } from "@/entities/cart";

export function buildClearCartInput(
  cart: Pick<Cart, "version">,
): UpdateCartInput {
  return {
    expectedVersion: cart.version,
    items: [],
  };
}
