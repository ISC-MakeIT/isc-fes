import {
  storeHomeUrl,
  storeKitchenUrl,
  storePickupUrl,
  storeCallUrl,
  storeMenusUrl,
  storeEditUrl,
} from "@/shared/config";
import { NavigationItems } from "../model/types";
import { StoreMemberRole } from "@/entities/store-member";

export function createStoreNavigationItems(
  storeId: string,
  storeMemberRole: StoreMemberRole,
): NavigationItems {
  const navigationItems: NavigationItems = [
    { label: "ホーム", href: storeHomeUrl(storeId) },
    { label: "作業場", href: storeKitchenUrl(storeId) },
    { label: "受け渡し", href: storePickupUrl(storeId) },
    { label: "呼び出し", href: storeCallUrl(storeId) },
  ];

  if (storeMemberRole === StoreMemberRole.Manager) {
    navigationItems.push({
      label: "商品管理",
      href: storeMenusUrl(storeId),
    });
    navigationItems.push({
      label: "店舗情報",
      href: storeEditUrl(storeId),
    });
  }

  return navigationItems;
}
