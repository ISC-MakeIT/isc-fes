import { StoreMember, StoreMemberRole } from "@/entities/store-member";
import { describe, expect, test } from "vitest";
import { canDeleteMember } from "./can-delete-member";

describe("canDeleteMember", () => {
  test("未所属のadminはスタッフを削除できるがmanagerは削除できない", () => {
    for (const role of [StoreMemberRole.Staff, StoreMemberRole.Manager]) {
      expect(
        canDeleteMember({
          currentAccountId: "admin",
          canManageMembers: true,
          targetMember: createStoreMember({ accountId: "other", role }),
        }),
      ).toBe(role === StoreMemberRole.Staff);
    }
  });
  test("マネージャーは自分以外のメンバーを削除できる", () => {
    const currentMember = createStoreMember({
      accountId: "account-1",
      role: StoreMemberRole.Manager,
    });
    const targetMember = createStoreMember({
      accountId: "account-2",
      role: StoreMemberRole.Staff,
    });

    const result = canDeleteMember({
      currentAccountId: currentMember.accountId,
      canManageMembers: currentMember.role === StoreMemberRole.Manager,
      targetMember,
    });

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

    const result = canDeleteMember({
      currentAccountId: currentMember.accountId,
      canManageMembers: currentMember.role === StoreMemberRole.Manager,
      targetMember,
    });

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

    const result = canDeleteMember({
      currentAccountId: currentMember.accountId,
      canManageMembers: currentMember.role === StoreMemberRole.Manager,
      targetMember,
    });

    expect(result).toBe(false);
  });

  test("対象が管理者なら削除できない", () => {
    const currentMember = createStoreMember({
      accountId: "account-1",
      role: StoreMemberRole.Manager,
    });
    const targetMember = createStoreMember({
      accountId: "account-2",
      role: StoreMemberRole.Manager,
    });

    const result = canDeleteMember({
      currentAccountId: currentMember.accountId,
      canManageMembers: currentMember.role === StoreMemberRole.Manager,
      targetMember,
    });

    expect(result).toBe(false);
  });
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
