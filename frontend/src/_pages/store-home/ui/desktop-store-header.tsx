"use client";

import { useSidebar, SidebarTrigger } from "@/shared/ui/sidebar";
import { PanelLeftOpenIcon } from "lucide-react";

export function DesktopStoreHeader() {
  const { state } = useSidebar();
  return (
    <>
      {state === "collapsed" && (
        <header className="bg-primary hidden items-center p-4 md:block">
          <SidebarTrigger icon={<PanelLeftOpenIcon className="size-6" />} />
        </header>
      )}
    </>
  );
}
