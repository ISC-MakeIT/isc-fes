import { CartItem, CartItemTopping } from "@/entities/cart";
import { describe, expect, test } from "vitest";
import { removeCartItemTopping } from "./remove-cart-item-toppings";

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

function createCartItemTopping(
  overrides: Partial<CartItemTopping> = {},
): CartItemTopping {
  return {
    id: "cart-item-topping-1",
    cartItemId: "item-1",
    toppingId: "topping-1",
    name: "テスト",
    available: true,
    unitPrice: 400,
    ...overrides,
  };
}

const cartItemToppings: CartItemTopping[] = [
  createCartItemTopping({ toppingId: "topping-1" }),
  createCartItemTopping({ toppingId: "topping-2" }),
];

const cartItems: CartItem[] = [
  createCartItem({ id: "item-1", toppings: cartItemToppings }),
  createCartItem({ id: "item-2", toppings: cartItemToppings }),
];

describe("removeCartItemTopping", () => {
  test("指定したカートアイテムから指定トッピングだけを削除する", () => {
    const result = removeCartItemTopping(cartItems, "item-1", "topping-1");

    expect(result[0]?.toppings.map((topping) => topping.toppingId)).toEqual([
      "topping-2",
    ]);
    expect(result[1]?.toppings.map((topping) => topping.toppingId)).toEqual([
      "topping-1",
      "topping-2",
    ]);
  });

  test("指定したトッピングが存在しない場合は変更しない", () => {
    const result = removeCartItemTopping(cartItems, "item-1", "hoge");

    expect(result).toBe(cartItems);
  });
});
