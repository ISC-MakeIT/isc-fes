import { v } from "@/shared/lib/valibot";

export const ToppingName = v.pipe(
  v.string(),
  v.minLength(1, "1文字以上で入力してください"),
  v.maxLength(30, "30文字以内で入力してください"),
);
export const ToppingUnitPrice = v.pipe(
  v.number("数値を入力してください"),
  v.minValue(0, "0円以上で入力してください"),
  v.maxValue(10000, "10,000円以下で入力してください"),
);

export const Topping = v.object({
  id: v.string(),
  storeId: v.string(),
  name: ToppingName,
  unitPrice: ToppingUnitPrice,
  soldOut: v.boolean(),
});
export type Topping = v.InferOutput<typeof Topping>;
