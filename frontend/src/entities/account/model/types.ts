import { v } from "@/shared/lib/valibot";

export enum AccountRole {
  Member = "member",
  Admin = "admin",
}
const AccountRoleSchema = v.enum(AccountRole);

export const Account = v.object({
  id: v.string(),
  email: v.string(),
  displayName: v.string(),
  pictureUrl: v.union([v.string(), v.null()]),
  role: AccountRoleSchema,
});

export type Account = v.InferOutput<typeof Account>;
