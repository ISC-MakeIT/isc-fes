import { v } from "@/shared/lib/valibot";

enum Role {
  Member = "member",
  Manager = "manager",
}

const RoleSchema = v.enum(Role);

export const StoreMember = v.object({
  storeId: v.pipe(v.string()),
  accountId: v.pipe(v.string()),
  role: RoleSchema,
  joinedAt: v.pipe(v.string(), v.toDate()),
  displayName: v.pipe(v.string()),
  pictureUrl: v.nullable(v.string()),
});

export type StoreMember = v.InferOutput<typeof StoreMember>;
