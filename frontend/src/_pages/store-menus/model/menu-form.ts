import { formOptions } from "@tanstack/react-form";
import { v } from "@/shared/lib/valibot";
import { MenuDescription, MenuName, MenuUnitPrice } from "@/entities/menu";
import { UploadImage } from "@/shared/model";
import { ToppingId } from "@/entities/topping";

export const MenuFormValues = v.object({
  name: MenuName,
  image: v.optional(UploadImage),
  unitPrice: v.optional(MenuUnitPrice),
  description: MenuDescription,
  toppingIds: v.array(ToppingId),
});
export type MenuFormValues = v.InferOutput<typeof MenuFormValues>;

const defaultMenuFormValues: MenuFormValues = {
  name: "",
  image: undefined,
  unitPrice: undefined,
  description: "",
  toppingIds: [],
};

export const CompleteEditMenuFormValues = v.object({
  name: MenuName,
  image: v.optional(UploadImage),
  unitPrice: MenuUnitPrice,
  description: MenuDescription,
  toppingIds: v.array(ToppingId),
});
export type CompleteEditMenuFormValues = v.InferOutput<
  typeof CompleteEditMenuFormValues
>;

export const menuFormOptions = formOptions({
  defaultValues: defaultMenuFormValues,
});
