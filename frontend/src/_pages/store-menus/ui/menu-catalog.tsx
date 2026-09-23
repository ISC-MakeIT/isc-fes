"use client";

import { cn } from "@/shared/lib/utils";
import { MenuList } from "./menu-list";
import { ToppingList } from "./topping-list";
import { useMenuEditor } from "../model/hooks/use-menu-editor";

export function MenuCatalog() {
  const { isOpen } = useMenuEditor();

  return (
    <div
      className={cn(
        "mx-4 space-y-20 py-18",
        isOpen ? "hidden lg:block" : "block",
      )}
    >
      <MenuList />
      <ToppingList />
    </div>
  );
}
