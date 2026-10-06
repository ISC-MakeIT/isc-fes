import {
  createSerializer,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";

export enum MenuEditorTarget {
  Menu = "menu",
  Topping = "topping",
}

export const menuEditorParsers = {
  editorTarget: parseAsStringEnum<MenuEditorTarget>(
    Object.values(MenuEditorTarget),
  ),
  itemId: parseAsString,
};

export const serializeMenuEditor = createSerializer(menuEditorParsers);
