"use client";

import { SidebarMenuButton, SidebarMenuItem } from "@/shared/ui/sidebar";
import { NavigationItems } from "../model/types";
import Link from "next/link";
import { DotText } from "@/shared/ui/dot-text";
import { usePathname } from "next/navigation";
import { sidebarNavigationStyle } from "./sidebar-navigation-styles";

type SidebarNavigationProps = {
  navigationItems: NavigationItems;
};

export function SidebarNavigation({ navigationItems }: SidebarNavigationProps) {
  const pathname = usePathname();

  return navigationItems.map((item) => (
    <SidebarMenuItem key={item.href}>
      <SidebarMenuButton
        size="lg"
        className={sidebarNavigationStyle}
        render={<Link href={item.href} />}
        isActive={pathname === item.href}
      >
        <DotText>{item.label}</DotText>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));
}
