"use client";

import { useForm } from "@tanstack/react-form";
import { MenuFormValues } from "../types";

type UseMenuFormOptions = {
  initialValues: MenuFormValues;
  requiresImage: true;
  onSubmit: (values: MenuFormValues) => Promise<void>;
};

// menu-form-fields側からtanstack formの型を使うためのフック
export function useMenuForm({
  initialValues,
  requiresImage,
  onSubmit,
}: UseMenuFormOptions) {
  return useForm({
    defaultValues: initialValues,
    validators: {
      onMount: MenuFormValues,
      onSubmit: ({ value }) => {
        if (requiresImage && !value.image) {
          return {
            fields: { image: { message: "メニュー写真を選択してください" } },
          };
        }
      },
    },
    onSubmit: ({ value }) => onSubmit(value),
  });
}

export type MenuFormApi = ReturnType<typeof useMenuForm>;
