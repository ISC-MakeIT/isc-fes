import { ToppingName, ToppingUnitPrice } from "@/entities/topping";
import { v } from "@/shared/lib/valibot";
import { formOptions } from "@tanstack/react-form";

export const ToppingFormValues = v.object({
  name: ToppingName,
  unitPrice: v.optional(ToppingUnitPrice),
});
export type ToppingFormValues = v.InferOutput<typeof ToppingFormValues>;

const defaultToppingFormValues: ToppingFormValues = {
  name: "",
  unitPrice: undefined,
};

const CompleteToppingFormValues = v.object({
  name: ToppingName,
  unitPrice: ToppingUnitPrice,
});

export const toppingFormOptions = formOptions({
  defaultValues: defaultToppingFormValues,
  validators: {
    onMount: CompleteToppingFormValues,
    onChange: CompleteToppingFormValues,
    onSubmit: CompleteToppingFormValues,
  },
});
