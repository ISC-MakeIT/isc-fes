"use client";

import { useIsStoreMemberOrAdmin } from "@/features/store-access";
import { guestStoreDetailUrl, homeUrl } from "@/shared/config";
import { LinkButton } from "@/shared/ui/link-button";
import { ChevronLeftIcon } from "lucide-react";

type OrderNavigationProps = {
  storeId: string;
};

export function OrderNavigation({ storeId }: OrderNavigationProps) {
  const isStoreMemberOrAdmin = useIsStoreMemberOrAdmin(storeId);

  return (
    <div className="flex w-full items-center justify-center gap-6">
      {isStoreMemberOrAdmin && (
        <LinkButton
          href={guestStoreDetailUrl(storeId)}
          aria-label="注文画面に戻る"
          className="shrink-0 px-6 py-2"
        >
          <ChevronLeftIcon className="size-8" />
        </LinkButton>
      )}

      <LinkButton
        href={homeUrl()}
        className="flex-1 px-4 py-2 text-[1.375rem] font-bold sm:flex-none sm:px-14"
      >
        トップに戻る
      </LinkButton>
    </div>
  );
}
