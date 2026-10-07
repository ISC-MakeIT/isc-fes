import { describe, expect, test } from "vitest";
import { increaseCartItemQuantity } from "./increase-cart-item-quantity";
import { CartItem } from "@/entities/cart";

function createCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "item-1",
    menuId: "menu-1",
    name: "テスト",
    available: true,
    imageUrl: "/menu.jpg",
    quantity: 2,
    toppings: [],
    unitPrice: 400,
    ...overrides,
  };
}

const cartItems: CartItem[] = [
  createCartItem({ id: "item-1", quantity: 2 }),
  createCartItem({ id: "item-2", quantity: 99 }),
  createCartItem({ id: "item-3", quantity: 0 }),
];

describe("increaseCartItemQuantity", () => {
  test("指定したアイテムの数量だけを1増やす", () => {
    const result = increaseCartItemQuantity(cartItems, "item-1");

    expect(result.map(({ id, quantity }) => ({ id, quantity }))).toEqual([
      { id: "item-1", quantity: 3 },
      { id: "item-2", quantity: 99 },
      { id: "item-3", quantity: 0 },
    ]);
  });

  test("数量が上限の場合は変更しない", () => {
    const result = increaseCartItemQuantity(cartItems, "item-2");

    expect(result).toBe(cartItems);
  });

  test("指定したアイテムが存在しない場合は変更しない", () => {
    const result = increaseCartItemQuantity(cartItems, "hoge");

    expect(result).toBe(cartItems);
  });
});
