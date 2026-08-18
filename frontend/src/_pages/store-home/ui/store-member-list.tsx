"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { storeMemberQueryOptions } from "../api/fetch-store-members";

type StoreMemberListProps = {
  storeId: string;
};

export function StoreMemberList({ storeId }: StoreMemberListProps) {
  const { data: members } = useSuspenseQuery(storeMemberQueryOptions(storeId));
  return (
    <>
      {members.map((m) => (
        <p key={m.accountId}>{m.displayName}</p>
      ))}
    </>
  );
}
