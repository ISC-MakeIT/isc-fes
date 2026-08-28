import { v } from "@/shared/lib/valibot";

export enum StoreMemberRole {
  Staff = "staff",
  Manager = "manager",
}

const StoreMemberRoleSchema = v.enum(StoreMemberRole);

export const StoreMember = v.object({
  storeId: v.pipe(v.string()),
  accountId: v.pipe(v.string()),
  role: StoreMemberRoleSchema,
  joinedAt: v.pipe(v.string(), v.toDate()),
  displayName: v.pipe(v.string()),
  pictureUrl: v.nullable(v.string()),
});

export type StoreMember = v.InferOutput<typeof StoreMember>;
