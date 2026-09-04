import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar";
import {
  AppSidebar,
  DesktopAppHeader,
  MobileAppHeader,
  storeNavigationItems,
} from "@/widgets/app-sidebar";

export default async function StoreManagerLayout(
  props: LayoutProps<"/member/stores/[storeId]">,
) {
  const { storeId } = await props.params;
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "10rem",
        } as React.CSSProperties
      }
      defaultOpen={false}
    >
      <AppSidebar navigationItems={storeNavigationItems(storeId)} />
      {/* NOTE: モバイルとデスクトップでヘッダーの位置も呼び出し箇所も大きく変わるのでコンポーネントも分けている */}
      <DesktopAppHeader />

      <SidebarInset>
        <MobileAppHeader />
        {props.children}
      </SidebarInset>
    </SidebarProvider>
  );
}
