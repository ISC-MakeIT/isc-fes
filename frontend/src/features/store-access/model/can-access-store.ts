import { AccountRole, fetchCurrentAccount } from "@/entities/account";
import { fetchStoreMemberByAccountId } from "@/entities/store-member";

export async function canAccessStore(storeId: string): Promise<boolean> {
  const account = await fetchCurrentAccount();

  if (!account) {
    return false;
  }

  if (account.role === AccountRole.Admin) {
    return true;
  }

  const member = await fetchStoreMemberByAccountId({
    storeId,
    accountId: account.id,
  });

  return member !== null;
}
