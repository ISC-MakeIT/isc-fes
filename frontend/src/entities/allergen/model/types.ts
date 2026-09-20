import { v } from "@/shared/lib/valibot";

export const Allergen = v.object({
  id: v.string(),
  name: v.string(),
});
export type Allergen = v.InferOutput<typeof Allergen>;
