import {
  storeHomeUrl,
  storeKitchenUrl,
  storePickupUrl,
  storeCallUrl,
  storeMenusUrl,
} from "@/shared/config";
import { NavigationItems } from "../model/types";

export function storeNavigationItems(storeId: string): NavigationItems {
  return [
    { label: "ホーム", href: storeHomeUrl(storeId) },
    { label: "作業場画面", href: storeKitchenUrl(storeId) },
    { label: "受け渡し画面", href: storePickupUrl(storeId) },
    { label: "呼び出し画面", href: storeCallUrl(storeId) },
    { label: "商品管理画面", href: storeMenusUrl(storeId) },
  ];
}
