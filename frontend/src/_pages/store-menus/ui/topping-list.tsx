"use client";

import { ActionButton } from "@/shared/ui/action-button";
import { PlusIcon } from "lucide-react";
import { EditorType, useMenuEditor } from "../model/menu-editor-context";

export function ToppingList() {
  const { setMenuEditor } = useMenuEditor();
  return (
    <div>
      <ActionButton
        className="px-6 py-4 text-lg font-bold"
        isDot={false}
        onClick={() => setMenuEditor([EditorType.CreateTopping])}
      >
        <PlusIcon className="size-6" />
        カスタマイズの追加
      </ActionButton>
    </div>
  );
}
