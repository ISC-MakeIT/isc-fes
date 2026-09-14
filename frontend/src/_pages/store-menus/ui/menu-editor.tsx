"use client";

import { ChevronLeftIcon } from "lucide-react";
import { EditorType, useMenuEditor } from "../model/menu-editor-context";
import { CreateMenuForm } from "./create-menu-form";
import { CreateToppingForm } from "./create-topping-form";
import { EditMenuForm } from "./edit-menu-form";

export function MenuEditor() {
  const { menuEditor, setMenuEditor } = useMenuEditor();
  const [type, id] = menuEditor;
  const isOpen = type !== EditorType.Closed;
  return (
    <div className={isOpen ? "block" : "hidden lg:block"}>
      <header className="shadow-editor-header bg-background px-4 py-1 lg:hidden">
        <button
          type="button"
          className="cursor-pointer"
          aria-label="一覧に戻る"
          onClick={() => setMenuEditor([EditorType.Closed])}
        >
          <ChevronLeftIcon size={50} strokeWidth={1} />
        </button>
      </header>

      <div className="flex h-full min-h-dvh flex-col py-18">
        <div className="lg:border-primary h-full px-6 py-4 lg:border-l">
          {type === EditorType.CreateMenu && <CreateMenuForm />}

          {/* keyを渡すことで、メニューのidが変わった時に再レンダリングを起こしている */}
          {type === EditorType.EditMenu && (
            <EditMenuForm key={id} menuId={id} />
          )}

          {type === EditorType.CreateTopping && <CreateToppingForm />}
        </div>
      </div>
    </div>
  );
}
