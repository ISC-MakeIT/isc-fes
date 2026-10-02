import { describe, expect, test } from "vitest";
import type { CartItem } from "../model/types";
import { summarizeCartItems } from "./summarize-cart-items";

function createItem(
  id: string,
  menuId: string,
  quantity: number,
  toppingIds: string[] = [],
): CartItem {
  return {
    id,
    menuId,
    name: `商品${menuId}`,
    imageUrl: `/${menuId}.jpg`,
    available: true,
    quantity,
    unitPrice: 400,
    toppings: toppingIds.map((toppingId) => ({
      id: `${id}-${toppingId}`,
      cartItemId: id,
      toppingId,
      name: `トッピング${toppingId}`,
      unitPrice: 100,
      available: true,
    })),
  };
}

describe("summarizeCartItems", () => {
  test("同じメニューとトッピングの商品をまとめて数量を合計する", () => {
    const items = [
      createItem("item-1", "menu-1", 2, ["topping-1", "topping-2"]),
      createItem("item-2", "menu-1", 3, ["topping-2", "topping-1"]),
    ];

    const result = summarizeCartItems(items);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      item: { menuId: "menu-1" },
      quantity: 5,
    });
  });

  test("同じメニューとトッピングの商品が複数該当しても正常にまとめる", () => {
    const items = [
      createItem("item-1", "menu-1", 2, ["topping-1", "topping-2"]),
      createItem("item-2", "menu-1", 3, ["topping-2", "topping-1"]),
      createItem("item-3", "menu-2", 2, ["topping-1", "topping-2"]),
      createItem("item-4", "menu-2", 3, ["topping-2", "topping-1"]),
      createItem("item-5", "menu-2", 2, []),
    ];

    const result = summarizeCartItems(items);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      item: { menuId: "menu-1" },
      quantity: 5,
    });
    expect(result[1]).toMatchObject({
      item: { menuId: "menu-2" },
      quantity: 5,
    });
    expect(result[2]).toMatchObject({
      item: { menuId: "menu-2" },
      quantity: 2,
    });
  });

  test("同じメニューでもトッピングが異なる商品はまとめない", () => {
    const result = summarizeCartItems([
      createItem("item-1", "menu-1", 1, ["topping-1"]),
      createItem("item-2", "menu-1", 1, ["topping-2"]),
    ]);

    expect(result).toHaveLength(2);
  });

  test("トッピングが同じでもメニューが異なる商品はまとめない", () => {
    const result = summarizeCartItems([
      createItem("item-1", "menu-1", 1, ["topping-1"]),
      createItem("item-2", "menu-2", 1, ["topping-1"]),
    ]);

    expect(result).toHaveLength(2);
  });

  test("空の配列は空の配列のまま返す", () => {
    expect(summarizeCartItems([])).toEqual([]);
  });
});
