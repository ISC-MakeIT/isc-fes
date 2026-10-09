import { homeUrl } from "@/shared/config";
import { SidebarMenuButton } from "@/shared/ui/sidebar";
import Link from "next/link";
import { sidebarNavigationStyle } from "./sidebar-navigation-styles";
import { DotText } from "@/shared/ui/dot-text";

export function GuestHomeNavigation() {
  return (
    <SidebarMenuButton
      size="lg"
      className={sidebarNavigationStyle}
      render={<Link href={homeUrl()} />}
    >
      <DotText>来場者用ページ</DotText>
    </SidebarMenuButton>
  );
}
