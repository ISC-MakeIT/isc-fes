import { StoreMenusView } from "@/_pages/store-menus";

export default async function StoreMenusPage({
  params,
}: PageProps<"/member/stores/[storeId]/menus">) {
  const { storeId } = await params;
  return <StoreMenusView storeId={storeId} />;
}
