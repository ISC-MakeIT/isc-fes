import { storeListUrl } from "@/shared/config";
import { DotText } from "@/shared/ui/dot-text";
import { SidebarMenuItem, SidebarMenuButton } from "@/shared/ui/sidebar";
import { sidebarNavigationStyle } from "./sidebar-navigation-styles";
import Link from "next/link";

export function StoreListNavigation() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size="lg"
        className={sidebarNavigationStyle}
        render={<Link href={storeListUrl()} />}
      >
        <DotText className="text-primary">店舗一覧</DotText>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
