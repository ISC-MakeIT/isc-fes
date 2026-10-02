"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/shared/ui/sidebar";
import { PanelLeftCloseIcon, PanelRightCloseIcon } from "lucide-react";

type AppSidebarProps = {
  children: React.ReactNode;
  className?: string;
};

export function AppSidebar({ children, className }: AppSidebarProps) {
  const { isMobile } = useSidebar();

  return (
    <Sidebar side={isMobile ? "right" : "left"} className={className}>
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

      <SidebarContent>{children}</SidebarContent>
    </Sidebar>
  );
}
