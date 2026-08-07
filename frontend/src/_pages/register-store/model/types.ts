import { v } from "@/shared/lib/valibot";

export const CreateStoreForm = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  room: v.pipe(v.string(), v.length(1), v.maxLength(50)),
  description: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  image: v.pipe(v.string()),
});

export type CreateStoreForm = v.InferOutput<typeof CreateStoreForm>;
