import { storeApplicationsUrl } from "@/shared/config";

export function adminNavigationItems() {
  return [{ label: "店舗申請", href: storeApplicationsUrl() }];
}
