"use client";

import { useIsStoreMemberOrAdmin } from "@/features/store-access";
import { storeCallUrl } from "@/shared/config";
import { BellRing } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

type StoreCallLinkProps = {
  storeId: string;
};

function StoreCallLink({ storeId }: StoreCallLinkProps) {
  const canAccessStore = useIsStoreMemberOrAdmin(storeId);

  if (!canAccessStore) {
    return null;
  }

  return (
    <Link
      href={storeCallUrl(storeId)}
      className="flex flex-row items-center gap-2"
    >
      <BellRing aria-hidden className="size-6" />
      <p className="text-sm">呼び出しへ</p>
    </Link>
  );
}

export function GuestStoreCallLink() {
  const { storeId } = useParams<{ storeId?: string }>();

  if (!storeId) {
    return null;
  }

  return <StoreCallLink storeId={storeId} />;
}
