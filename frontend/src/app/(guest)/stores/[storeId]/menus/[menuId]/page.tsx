import { GuestMenuDetailView } from "@/_pages/guest-menu-detail";

export default async function GuestMenuDetailPage({
  params,
}: PageProps<"/stores/[storeId]/menus/[menuId]">) {
  const { menuId, storeId } = await params;

  return <GuestMenuDetailView storeId={storeId} menuId={menuId} />;
}
