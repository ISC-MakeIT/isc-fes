import { SidebarInset } from "@/shared/ui/sidebar";
import {
  adminNavigationItems,
  AppSidebar,
  DesktopAppHeader,
  MobileAppHeader,
} from "@/widgets/app-sidebar";

export function StoreApplicationsView() {
  return (
    <>
      <AppSidebar navigationItems={adminNavigationItems()} />
      <DesktopAppHeader />

      <SidebarInset>
        <MobileAppHeader />
        <div>hoge</div>
      </SidebarInset>
    </>
  );
}
