"use client";

import { useForm } from "@tanstack/react-form";
import { CreateMenuInput, MenuFormValues } from "../types";

type UseMenuFormOptions = {
  initialValues: MenuFormValues;
  onSubmit: (values: MenuFormValues) => Promise<void>;
};

// menu-form-fields側からtanstack formの型を使うためのフック
export function useMenuForm({ initialValues, onSubmit }: UseMenuFormOptions) {
  return useForm({
    defaultValues: initialValues,
    validators: {
      onMount: MenuFormValues,
      onSubmit: CreateMenuInput,
    },
    onSubmit: ({ value }) => onSubmit(value),
  });
}

export type MenuFormApi = ReturnType<typeof useMenuForm>;
