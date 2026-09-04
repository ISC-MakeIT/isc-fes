"use client";

import { useForm } from "@tanstack/react-form";
import { MenuFormValues } from "../types";
import { v } from "@/shared/lib/valibot";

type UseMenuFormOptions<TValues extends MenuFormValues> = {
  initialValues: MenuFormValues;
  submitSchema: v.GenericSchema<TValues>;
  onSubmit: (values: MenuFormValues) => Promise<void>;
};

// menu-form-fields側からtanstack formの型を使うためのフック
export function useMenuForm<TValues extends MenuFormValues>({
  initialValues,
  onSubmit,
  submitSchema,
}: UseMenuFormOptions<TValues>) {
  return useForm({
    defaultValues: initialValues,
    validators: {
      onMount: MenuFormValues,
      onSubmit: submitSchema,
    },
    onSubmit: ({ value }) => onSubmit(value),
  });
}

export type MenuFormApi = ReturnType<typeof useMenuForm>;
