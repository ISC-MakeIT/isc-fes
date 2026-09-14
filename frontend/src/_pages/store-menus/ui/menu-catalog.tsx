"use client";

import { cn } from "@/shared/lib/utils";
import { EditorType, useMenuEditor } from "../model/menu-editor-context";
import { MenuList } from "./menu-list";
import { ToppingList } from "./topping-list";

export function MenuCatalog() {
  const { menuEditor } = useMenuEditor();
  const [type] = menuEditor;
  const isOpen = type !== EditorType.Closed;

  return (
    <div
      className={cn(
        "mx-4 space-y-20 py-18",
        isOpen ? "hidden md:block" : "block",
      )}
    >
      <MenuList />
      <ToppingList />
    </div>
  );
}
