"use client";

import { EditorType, useMenuEditor } from "../model/menu-editor-context";
import { CreateMenuForm } from "./create-menu-form";
import { EditMenuForm } from "./edit-menu-form";

export function MenuEditor() {
  const { menuEditor } = useMenuEditor();
  const [type, id] = menuEditor;
  return (
    <div className="border-primary flex min-h-screen flex-col border-l px-6 pt-18">
      {type === EditorType.CreateMenu && <CreateMenuForm />}
      {/* keyを渡すことで、メニューのidが変わった時に再レンダリングを起こしている */}
      {type === EditorType.EditMenu && <EditMenuForm key={id} menuId={id} />}
    </div>
  );
}
