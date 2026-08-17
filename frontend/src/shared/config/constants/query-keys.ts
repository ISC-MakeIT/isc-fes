export const keys = {
  storeDetail: (storeId: string) => ["store", storeId],
  storeMenus: (storeId: string) => ["store", "menus", storeId],
} as const;
