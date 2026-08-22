import { Store } from "@/entities/store";
import { v } from "@/shared/lib/valibot";

export const StoreApplications = v.object({
  ...Store.entries,
  submittedAt: v.pipe(v.string(), v.toDate()),
});

export type StoreApplications = v.InferOutput<typeof StoreApplications>;
