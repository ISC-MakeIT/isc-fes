import { Store } from "@/entities/store";
import { v } from "@/shared/lib/valibot";

export const StoreApplication = v.object({
  ...Store.entries,
  submittedAt: v.pipe(v.string(), v.toDate()),
});

export type StoreApplication = v.InferOutput<typeof StoreApplication>;
