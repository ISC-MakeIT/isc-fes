"use client";

import { useIsStoreMemberOrAdmin } from "@/features/store-access";
import { guestStoreDetailUrl, homeUrl } from "@/shared/config";
import { LinkButton } from "@/shared/ui/link-button";

type OrderNavigationProps = {
  storeId: string;
};

export function OrderNavigation({ storeId }: OrderNavigationProps) {
  const canContinueOrdering = useIsStoreMemberOrAdmin(storeId);

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <LinkButton
        href={homeUrl()}
        className="w-full px-4 py-2 text-base font-bold sm:w-auto sm:px-14 sm:text-[1.375rem]"
      >
        トップに戻る
      </LinkButton>

      {canContinueOrdering && (
        <LinkButton
          href={guestStoreDetailUrl(storeId)}
          variant="link"
          className="w-full px-4 py-2 text-xl font-bold underline shadow-none sm:w-auto"
        >
          ＜ 続けて注文する
        </LinkButton>
      )}
    </div>
  );
}
