import { StoreMember, StoreMemberRole } from "@/entities/store-member";
import { expect, test } from "vitest";
import { canDeleteMember } from "./can-delete-member";

test("マネージャーは自分以外のメンバーを削除できる", () => {
  const currentMember = createStoreMember({
    accountId: "account-1",
    role: StoreMemberRole.Manager,
  });
  const targetMember = createStoreMember({
    accountId: "account-2",
    role: StoreMemberRole.Staff,
  });

  const result = canDeleteMember({ currentMember, targetMember });

  expect(result).toBe(true);
});

test("スタッフは他のメンバーを削除できない", () => {
  const currentMember = createStoreMember({
    accountId: "account-1",
    role: StoreMemberRole.Staff,
  });
  const targetMember = createStoreMember({
    accountId: "account-2",
    role: StoreMemberRole.Staff,
  });

  const result = canDeleteMember({ currentMember, targetMember });

  expect(result).toBe(false);
});

test("自分自身は削除できない", () => {
  const currentMember = createStoreMember({
    accountId: "account-1",
    role: StoreMemberRole.Manager,
  });
  const targetMember = createStoreMember({
    accountId: "account-1",
    role: StoreMemberRole.Manager,
  });

  const result = canDeleteMember({ currentMember, targetMember });

  expect(result).toBe(false);
});

function createStoreMember({
  accountId,
  role,
}: Pick<StoreMember, "accountId" | "role">): StoreMember {
  return {
    storeId: "store-1",
    accountId,
    role,
    displayName: "テストユーザー",
    // テストの結果を実行時間に依存させないため固定の日時にする
    joinedAt: new Date("2000-01-01"),
    pictureUrl: null,
  };
}
