"use client";

import { useCartOperation } from "../model/cart-operation-context";
import { CartItemRow } from "./cart-item-row";

export function CartContents() {
  const { displayedCartItems } = useCartOperation();

  return (
    <ul className="flex flex-col overflow-y-auto">
      {displayedCartItems.map((item) => (
        <CartItemRow cartItem={item} />
      ))}
    </ul>
  );
}
