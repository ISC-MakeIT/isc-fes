"use client";

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

type AppSidebarProps = {
  navigationItems: { label: string; href: string }[];
  className?: string;
};

export function AppSidebar({ navigationItems, className }: AppSidebarProps) {
  const pathname = usePathname();
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
