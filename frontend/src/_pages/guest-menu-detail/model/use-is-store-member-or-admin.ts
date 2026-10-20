"use client";

import { AccountRole, currentAccountQueryOptions } from "@/entities/account";
import { storeMemberByAccountIdQueryOptions } from "@/entities/store-member";
import { useQuery } from "@tanstack/react-query";

export function useIsStoreMemberOrAdmin(storeId: string): boolean {
  const { data: account } = useQuery(currentAccountQueryOptions());

  const { data: member } = useQuery({
    ...storeMemberByAccountIdQueryOptions(storeId, account?.id ?? ""),
    enabled: !!account && account.role !== AccountRole.Admin,
  });

  if (account && (account.role === AccountRole.Admin || member)) {
    return true;
  }

  return false;
}
