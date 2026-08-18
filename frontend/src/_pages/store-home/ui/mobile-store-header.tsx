"use client";

import { SidebarTrigger } from "@/shared/ui/sidebar";
import { MenuIcon } from "lucide-react";

export function MobileStoreHeader() {
  return (
    <header className="bg-primary flex h-20 w-full flex-row-reverse items-center pr-6 md:hidden">
      <SidebarTrigger icon={<MenuIcon className="size-6" />} />
    </header>
  );
}
