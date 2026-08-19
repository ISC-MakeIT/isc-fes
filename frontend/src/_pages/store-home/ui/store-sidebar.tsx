"use client";

import {
  storeCallUrl,
  storeHomeUrl,
  storeKitchenUrl,
  storeMenusUrl,
  storePickupUrl,
} from "@/shared/config";
import { DotText } from "@/shared/ui/dot-text";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/shared/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftCloseIcon, PanelRightCloseIcon } from "lucide-react";

export function createStoreNavigationItems(storeId: string) {
  return [
    { label: "ホーム", href: storeHomeUrl(storeId) },
    { label: "作業場画面", href: storeKitchenUrl(storeId) },
    { label: "受け渡し画面", href: storePickupUrl(storeId) },
    { label: "呼び出し画面", href: storeCallUrl(storeId) },
    { label: "商品管理画面", href: storeMenusUrl(storeId) },
  ];
}

type StoreSidebarProps = {
  storeId: string;
  className?: string;
};

export function StoreSidebar({ storeId, className }: StoreSidebarProps) {
  const navigationItems = createStoreNavigationItems(storeId);

  const pathname = usePathname();
  const { isMobile } = useSidebar();

  return (
    <Sidebar side={isMobile ? "right" : "left"} className={className}>
      <SidebarHeader className="bg-sidebar-header items-end justify-center px-6 py-4">
        <SidebarTrigger
          className="size-9"
          icon={
            isMobile ? (
              <PanelRightCloseIcon className="size-5" />
            ) : (
              <PanelLeftCloseIcon className="size-5" />
            )
          }
        />
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {navigationItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                size="lg"
                className="h-auto rounded-none py-6 pl-6"
                render={<Link href={item.href} />}
                isActive={pathname === item.href}
              >
                <DotText className="text-base">{item.label}</DotText>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
