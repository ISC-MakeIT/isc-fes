import { v } from "@/shared/lib/valibot";

export const Menu = v.object({
  id: v.pipe(v.string()),
  storeId: v.pipe(v.string()),
  name: v.pipe(v.string()),
  description: v.pipe(v.string()),
  unitPrice: v.pipe(v.number()),
  imageUrl: v.pipe(v.string()),
  soldOut: v.pipe(v.boolean()),
  updatedAt: v.pipe(v.string(), v.toDate()),
  createdAt: v.pipe(v.string(), v.toDate()),
});

export type Menu = v.InferOutput<typeof Menu>;
