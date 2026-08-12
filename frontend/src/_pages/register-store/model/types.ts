import { Store, StoreImage } from "@/entities/store";
import { v } from "@/shared/lib/valibot";

export const CreateStoreForm = v.object({
  ...Store.entries,
  // Inputの初期値用にundefinedを許容する
  image: v.optional(StoreImage),
});

export type CreateStoreForm = v.InferOutput<typeof CreateStoreForm>;
