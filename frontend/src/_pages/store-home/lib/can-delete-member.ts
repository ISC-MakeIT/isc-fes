import { StoreMember, StoreMemberRole } from "@/entities/store-member";

type CanDeleteMemberParams = {
  currentMember: StoreMember;
  targetMember: StoreMember;
};

export function canDeleteMember({
  currentMember,
  targetMember,
}: CanDeleteMemberParams) {
  return (
    currentMember.role === StoreMemberRole.Manager &&
    targetMember.accountId !== currentMember.accountId
  );
}
