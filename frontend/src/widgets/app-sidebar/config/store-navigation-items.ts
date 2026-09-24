import {
  storeHomeUrl,
  storeKitchenUrl,
  storePickupUrl,
  storeCallUrl,
  storeMenusUrl,
} from "@/shared/config";
import { NavigationItems } from "../model/types";
import { StoreMemberRole } from "@/entities/store-member";

export function storeNavigationItems(
  storeId: string,
  storeMemberRole: StoreMemberRole,
): NavigationItems {
  const navigationItems: NavigationItems = [
    { label: "ホーム", href: storeHomeUrl(storeId) },
    { label: "作業場画面", href: storeKitchenUrl(storeId) },
    { label: "受け渡し画面", href: storePickupUrl(storeId) },
    { label: "呼び出し画面", href: storeCallUrl(storeId) },
  ];

  if (storeMemberRole === StoreMemberRole.Manager) {
    navigationItems.push({
      label: "商品管理画面",
      href: storeMenusUrl(storeId),
    });
  }

  return navigationItems;
}
