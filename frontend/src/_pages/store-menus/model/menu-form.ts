import { formOptions } from "@tanstack/react-form";
import { v } from "@/shared/lib/valibot";
import { MenuDescription, MenuName, MenuUnitPrice } from "@/entities/menu";
import { UploadImage } from "@/shared/model";

export const MenuFormValues = v.object({
  name: MenuName,
  image: v.optional(UploadImage),
  unitPrice: v.optional(MenuUnitPrice),
  description: MenuDescription,
  // TODO: トッピング
});

export type MenuFormValues = v.InferOutput<typeof MenuFormValues>;

const defaultMenuFormValues: MenuFormValues = {
  name: "",
  image: undefined,
  unitPrice: undefined,
  description: "",
};

export const menuFormOptions = formOptions({
  defaultValues: defaultMenuFormValues,
  validators: {
    onMount: MenuFormValues,
  },
});
