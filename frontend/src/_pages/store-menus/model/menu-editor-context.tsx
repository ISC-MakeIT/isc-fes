"use client";

import { createContext, use, useState } from "react";

export enum EditorType {
  Closed = "closed",
  CreateMenu = "createMenu",
  EditMenu = "editMenu",
  CreateTopping = "createTopping",
  EditTopping = "editTopping",
}

type MenuEditorState =
  | [EditorType.Closed]
  | [EditorType.CreateMenu]
  | [EditorType.EditMenu, menuId: string]
  | [EditorType.CreateTopping]
  | [EditorType.EditTopping, toppingId: string];

type MenuEditorContextValue = {
  menuEditor: MenuEditorState;
  setMenuEditor: (menuEditor: MenuEditorState) => void;
};

const MenuEditorContext = createContext<MenuEditorContextValue | undefined>(
  undefined,
);

export function MenuEditorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menuEditor, setMenuEditor] = useState<MenuEditorState>([
    EditorType.Closed,
  ]);

  return (
    <MenuEditorContext value={{ menuEditor, setMenuEditor }}>
      {children}
    </MenuEditorContext>
  );
}

export function useMenuEditor() {
  const context = use(MenuEditorContext);
  if (!context) {
    throw new Error(
      "useMenuEditor は MenuEditorProvider 内で使用してください。",
    );
  }
  return context;
}
