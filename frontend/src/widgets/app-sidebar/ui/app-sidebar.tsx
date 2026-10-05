"use client";

import { StoreMemberRole } from "@/entities/store-member";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarTrigger,
  useSidebar,
} from "@/shared/ui/sidebar";
import { PanelLeftCloseIcon, PanelRightCloseIcon } from "lucide-react";
import { createAdminNavigationItems } from "../config/create-admin-navigation-items";
import { createStoreNavigationItems } from "../config/create-store-navigation-items";
import { SidebarNavigation } from "./sidebar-navigation";
import { SidebarSupportNavigation } from "./sidebar-support-navigation";
import { StoreListNavigation } from "./store-list-navigation";

export type AppSidebarProps =
  | { variant: "admin" }
  | { variant: "store"; storeId: string; memberRole: StoreMemberRole };

export function AppSidebar(props: AppSidebarProps) {
  const { isMobile } = useSidebar();

  const navigationItems =
    props.variant === "admin"
      ? createAdminNavigationItems()
      : createStoreNavigationItems(props.storeId, props.memberRole);

  return (
    <Sidebar side={isMobile ? "right" : "left"}>
      <SidebarHeader className="bg-sidebar-header h-18 items-end justify-center px-6 py-4 md:items-start">
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

      <SidebarContent className="space-y-6">
        <SidebarMenu>
          <StoreListNavigation />
        </SidebarMenu>

        <SidebarMenu>
          <SidebarNavigation navigationItems={navigationItems} />
        </SidebarMenu>

        <SidebarMenu>
          <SidebarSupportNavigation />
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
