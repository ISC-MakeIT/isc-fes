import { v } from "@/shared/lib/valibot";

export const MenuName = v.pipe(
  v.string(),
  v.minLength(1, "1文字以上で入力してください"),
  v.maxLength(30, "30文字以内で入力してください"),
);

export const MenuDescription = v.pipe(
  v.string(),
  v.minLength(1, "1文字以上で入力してください"),
  v.maxLength(150, "150文字以内で入力してください"),
);

export const MenuUnitPrice = v.pipe(
  v.number(),
  v.minValue(0, "0円以上で入力してください"),
  v.maxValue(10000, "1万円以内で入力してください"),
);

export const Menu = v.object({
  id: v.pipe(v.string()),
  storeId: v.pipe(v.string()),
  name: MenuName,
  description: MenuDescription,
  unitPrice: MenuUnitPrice,
  imageUrl: v.pipe(v.string()),
  soldOut: v.pipe(v.boolean()),
  updatedAt: v.pipe(v.string(), v.toDate()),
  createdAt: v.pipe(v.string(), v.toDate()),
});

export type Menu = v.InferOutput<typeof Menu>;
