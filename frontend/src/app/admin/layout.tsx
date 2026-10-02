import { fetchCurrentAccount } from "@/entities/account";
import { AccountRole } from "@/entities/account";
import { loginUrl, storeListUrl } from "@/shared/config";
import {
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@/shared/ui/sidebar";
import {
  AppSidebar,
  createAdminNavigationItems,
  DesktopAppHeader,
  MobileAppHeader,
  SidebarNavigation,
  SidebarSupportNavigation,
} from "@/widgets/app-sidebar";
import { redirect } from "next/navigation";

export default async function AdminLayout(props: LayoutProps<"/admin">) {
  const currentAccount = await fetchCurrentAccount();

  if (!currentAccount) redirect(loginUrl());

  if (currentAccount.role !== AccountRole.Admin) {
    redirect(storeListUrl());
  }

  const adminNavigationItems = createAdminNavigationItems();

  return (
    <SidebarProvider>
      <AppSidebar>
        <div className="space-y-6">
          <SidebarMenu>
            <SidebarNavigation navigationItems={adminNavigationItems} />
          </SidebarMenu>
          <SidebarMenu>
            <SidebarSupportNavigation />
          </SidebarMenu>
        </div>
      </AppSidebar>
      {/* NOTE: モバイルとデスクトップでヘッダーの位置も呼び出し箇所も大きく変わるのでコンポーネントも分けている */}
      <DesktopAppHeader />

      <SidebarInset>
        <MobileAppHeader />
        {props.children}
      </SidebarInset>
    </SidebarProvider>
  );
}
