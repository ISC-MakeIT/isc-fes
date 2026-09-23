"use client";

import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

export enum EditorTarget {
  Menu = "menu",
  Topping = "topping",
}

const editorParsers = {
  editorTarget: parseAsStringEnum<EditorTarget>(Object.values(EditorTarget)),
  itemId: parseAsString,
};

export function useMenuEditor() {
  const [{ editorTarget, itemId }, setEditor] = useQueryStates(editorParsers, {
    history: "push",
    urlKeys: {
      editorTarget: "editor",
      itemId: "id",
    },
  });

  const normalizedItemId = editorTarget && itemId ? itemId : null;

  function openEditor(target: EditorTarget, id?: string) {
    return setEditor({
      editorTarget: target,
      itemId: id ?? null,
    });
  }

  function closeEditor() {
    return setEditor(null);
  }

  return {
    editorTarget,
    itemId: normalizedItemId,
    isOpen: editorTarget !== null,
    openEditor,
    closeEditor,
  };
}
