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

  function openEditor(target: MenuEditorTarget, id?: string) {
    return setEditor({
      editorTarget: target,
      itemId: id ?? null,
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
