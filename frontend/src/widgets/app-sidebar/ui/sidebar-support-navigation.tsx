import { SidebarMenuButton, SidebarMenuItem } from "@/shared/ui/sidebar";
import Link from "next/link";
import { DotText } from "@/shared/ui/dot-text";
import { sidebarNavigationStyle } from "./sidebar-navigation-styles";
import { createSupportNavigationItems } from "../config/create-support-navigation-items";

export function SidebarSupportNavigation() {
  const supportNavigationItems = createSupportNavigationItems();

  return supportNavigationItems.map((item) => (
    <SidebarMenuItem key={item.href}>
      <SidebarMenuButton
        size="lg"
        className={sidebarNavigationStyle}
        render={<Link href={item.href} />}
      >
        <DotText>{item.label}</DotText>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));
}
