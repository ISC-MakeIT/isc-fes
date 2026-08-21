import { storeApplicationsUrl } from "@/shared/config";
import { NavigationItems } from "../model/types";

export function adminNavigationItems(): NavigationItems {
  return [{ label: "店舗申請", href: storeApplicationsUrl() }];
}
