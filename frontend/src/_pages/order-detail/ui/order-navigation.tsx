import { guestStoreDetailUrl, homeUrl } from "@/shared/config";
import { LinkButton } from "@/shared/ui/link-button";

type OrderNavigationProps = {
  canContinueOrdering: boolean;
  storeId: string;
};

export function OrderNavigation({
  canContinueOrdering,
  storeId,
}: OrderNavigationProps) {
  return (
    <div className="flex w-full items-center justify-center gap-6">
      {canContinueOrdering && (
        <LinkButton
          href={guestStoreDetailUrl(storeId)}
          className="shrink-0 px-4 py-2 text-base font-bold sm:text-[1.375rem]"
        >
          ＜ 注文画面へ
        </LinkButton>
      )}

      <LinkButton
        href={homeUrl()}
        className="flex-1 px-4 py-2 text-base font-bold sm:flex-none sm:px-14 sm:text-[1.375rem]"
      >
        トップに戻る
      </LinkButton>
    </div>
  );
}
