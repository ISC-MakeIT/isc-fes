"use client";

import { EditorType, useMenuEditor } from "../model/menu-editor-context";
import { CreateMenuForm } from "./create-menu-form";

export function Editor() {
  const { menuEditor } = useMenuEditor();
  const [type] = menuEditor;
  return (
    <div className="border-primary flex min-h-screen flex-col border-l px-6 pt-18">
      {type === EditorType.CreateMenu && <CreateMenuForm />}
    </div>
  );
}
