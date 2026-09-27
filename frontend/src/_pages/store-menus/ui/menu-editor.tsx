"use client";

import { ChevronLeftIcon } from "lucide-react";
import { CreateMenuForm } from "./create-menu-form";
import { CreateToppingForm } from "./create-topping-form";
import { EditMenuForm } from "./edit-menu-form";
import { EditToppingForm } from "./edit-topping-form";
import { EditorTarget, useMenuEditor } from "../model/hooks/use-menu-editor";

export function MenuEditor() {
  const { editorTarget, itemId, isOpen, closeEditor } = useMenuEditor();

  return (
    <div className={isOpen ? "block" : "hidden lg:block"}>
      <header className="shadow-editor-header bg-background px-4 py-1 lg:hidden">
        <button
          type="button"
          className="cursor-pointer"
          aria-label="一覧に戻る"
          onClick={closeEditor}
        >
          <ChevronLeftIcon size={50} strokeWidth={1} />
        </button>
      </header>

      <div className="flex h-full min-h-dvh flex-col py-18">
        <div className="lg:border-primary h-full px-6 py-4 lg:border-l">
          {editorTarget === EditorTarget.Menu && !itemId && <CreateMenuForm />}

          {/* keyを渡すことで、メニューのidが変わった時に再レンダリングを起こしている */}
          {editorTarget === EditorTarget.Menu && itemId && (
            <EditMenuForm key={itemId} menuId={itemId} />
          )}

          {editorTarget === EditorTarget.Topping && !itemId && (
            <CreateToppingForm />
          )}

          {editorTarget === EditorTarget.Topping && itemId && (
            <EditToppingForm key={itemId} toppingId={itemId} />
          )}
        </div>
      </div>
    </div>
  );
}
