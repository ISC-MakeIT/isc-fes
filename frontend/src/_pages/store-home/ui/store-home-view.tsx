import { StoreInfo } from "./store-info";
import { StoreMenuList } from "./store-menu-list";
import { StoreMembersSection } from "./store-member-section";
import { HeadingCard } from "@/shared/ui/heading-card";

type StoreHomeViewProps = { storeId: string };

export async function StoreHomeView({ storeId }: StoreHomeViewProps) {
  return (
    <>
      <div className="flex flex-1 flex-col pt-18">
        <HeadingCard className="mb-6 self-center md:hidden">ホーム</HeadingCard>
        <StoreInfo storeId={storeId} />
        <div className="md:grid md:flex-1 md:grid-cols-[1fr_24rem]">
          <StoreMenuList className="hidden md:block" storeId={storeId} />
          <StoreMembersSection storeId={storeId} />
        </div>
      </div>
    </>
  );
}
