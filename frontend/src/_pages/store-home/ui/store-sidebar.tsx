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

type StoreSidebarProps = {
  storeId: string;
};

export function StoreSidebar({ storeId }: StoreSidebarProps) {
  const navigationItems = [
    { label: "ホーム", href: storeHomeUrl(storeId) },
    { label: "作業場画面", href: storeKitchenUrl(storeId) },
    { label: "受け渡し画面", href: storePickupUrl(storeId) },
    { label: "呼び出し画面", href: storeCallUrl(storeId) },
    { label: "商品管理画面", href: storeMenusUrl(storeId) },
  ];

  const pathName = usePathname();
  const { isMobile } = useSidebar();

  return (
    <>
      <Sidebar side={isMobile ? "right" : "left"}>
        <SidebarHeader className="bg-sidebar-header items-end">
          <SidebarTrigger
            icon={
              isMobile ? (
                <PanelRightCloseIcon className="size-6" />
              ) : (
                <PanelLeftCloseIcon className="size-6" />
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
                  className="h-16 rounded-none pl-6"
                  render={<Link href={item.href} />}
                  isActive={pathName === item.href}
                >
                  <DotText className="text-lg">{item.label}</DotText>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    </>
  );
}
