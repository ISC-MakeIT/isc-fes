import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar";
import { AppSidebar, AppSidebarProps } from "./app-sidebar";
import { DesktopAppHeader } from "./desktop-app-header";
import { MobileAppHeader } from "./mobile-app-header";

type AppSidebarLayoutProps = {
  children: React.ReactNode;
  sidebar: AppSidebarProps;
};

export function AppSidebarLayout({ children, sidebar }: AppSidebarLayoutProps) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "10rem",
        } as React.CSSProperties
      }
      defaultOpen
    >
      <AppSidebar {...sidebar} />
      {/* NOTE: モバイルとデスクトップでヘッダーの位置も呼び出し箇所も大きく変わるのでコンポーネントも分けている */}
      <DesktopAppHeader />

      <SidebarInset>
        <MobileAppHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
