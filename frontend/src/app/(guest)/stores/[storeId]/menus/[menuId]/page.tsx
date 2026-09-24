import { GuestMenuDetailView } from "@/_pages/guest-menu-detail";

export default async function GuestMenuDetailPage({
  params,
}: PageProps<"/stores/[storeId]/menus/[menuId]">) {
  const { menuId } = await params;
  return <GuestMenuDetailView menuId={menuId} />;
}
