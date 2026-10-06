"use client";

import { menuEditorParsers, MenuEditorTarget } from "@/shared/config";
import { useQueryStates } from "nuqs";

export function useMenuEditor() {
  const [{ editorTarget, itemId }, setEditor] = useQueryStates(
    menuEditorParsers,
    {
      history: "push",
    },
  );

  function openEditor(editorTarget: MenuEditorTarget, itemId?: string) {
    return setEditor({
      editorTarget,
      itemId: itemId ?? null,
    });
  }

  function closeEditor() {
    return setEditor(null, { history: "replace" });
  }

  return {
    editorTarget,
    itemId,
    isOpen: editorTarget !== null,
    openEditor,
    closeEditor,
  };
}
