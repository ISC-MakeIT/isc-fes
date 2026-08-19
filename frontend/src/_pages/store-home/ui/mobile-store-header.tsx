"use client";

import { SidebarTrigger } from "@/shared/ui/sidebar";
import { MenuIcon } from "lucide-react";

export function MobileStoreHeader() {
  return (
    <header className="bg-primary flex h-18 w-full flex-row-reverse items-center px-6 md:hidden">
      <SidebarTrigger
        className="size-9"
        icon={<MenuIcon className="size-7" />}
      />
    </header>
  );
}
