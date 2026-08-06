import { v } from "@/shared/lib/valibot";

export const Account = v.object({
  id: v.string(),
  email: v.string(),
  displayName: v.string(),
  pictureUrl: v.union([v.string(), v.null()]),
  role: v.picklist(["member", "admin"]),
});

export type Account = v.InferOutput<typeof Account>;
