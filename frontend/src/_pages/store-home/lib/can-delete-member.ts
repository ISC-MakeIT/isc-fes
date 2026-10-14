import { StoreMember, StoreMemberRole } from "@/entities/store-member";

type CanDeleteMemberParams = {
  currentAccountId: string;
  canManageMembers: boolean;
  targetMember: StoreMember;
};

export function canDeleteMember({
  currentAccountId,
  canManageMembers,
  targetMember,
}: CanDeleteMemberParams) {
  return (
    canManageMembers &&
    targetMember.accountId !== currentAccountId &&
    targetMember.role !== StoreMemberRole.Manager
  );
}
