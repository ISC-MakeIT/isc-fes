export const storeDetailKey = (storeId: string) => ["store", storeId];
export const storeMenusKey = (storeId: string) => ["store", "menus", storeId];
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
export const activeRoomsKey = () => ["active-rooms"];
