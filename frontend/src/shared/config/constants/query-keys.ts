export const storesKey = () => ["stores"];
export const storeDetailKey = (storeId: string) => ["store", storeId];
export const storeMenusKey = (storeId: string) => ["store", "menus", storeId];
export const storeToppingsKey = (storeId: string) => [
  "store",
  "toppings",
  storeId,
];
export const storeMemberKey = (storeId: string, accountId: string) => [
  "store",
  storeId,
  "member",
  accountId,
];
export const storeMembersKey = (storeId: string) => [
  "store",
  "members",
  storeId,
];
export const currentAccountKey = () => ["account", "me"];
export const storeApplicationsKey = () => ["store-applications"];
export const roomsKey = () => ["rooms"];
export const allergensKey = () => ["allergens"];

// トッピング自体を編集したときなど、メニューのキャッシュをまとめて消したい場合はallを使う
// Tanstack Queryでは先頭のキーが一致していればその後続のキーも対象内になる
export const menuToppingsKeys = {
  all: (storeId: string) => ["store", storeId, "menuToppings"] as const,
  detail: (storeId: string, menuId: string) =>
    [...menuToppingsKeys.all(storeId), menuId] as const,
};

export const cartKey = (storeId: string) => ["store", storeId, "cart"];
