"use client";

import { useSidebar, SidebarTrigger } from "@/shared/ui/sidebar";
import { PanelLeftOpenIcon } from "lucide-react";

export function DesktopAppHeader() {
  const { state } = useSidebar();
  return (
    <>
      {state === "collapsed" && (
        <header className="bg-primary z-20 hidden px-4 py-10 shadow-[4px_4px_2px_#5E4D9C40] md:block">
          <SidebarTrigger
            className="size-9"
            icon={<PanelLeftOpenIcon className="size-5" />}
          />
        </header>
      )}
    </>
  );
}
