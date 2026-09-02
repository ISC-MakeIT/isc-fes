import { StoreMenusView } from "@/_pages/store-menus/ui/store-menus-view";

export default async function StoreMenusPage({
  params,
}: PageProps<"/member/stores/[id]/menus">) {
  const { id } = await params;
  return <StoreMenusView storeId={id} />;
}
