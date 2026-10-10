import { OrderDetailView } from "@/_pages/order-detail";

export default async function OrderDetailPage({
  params,
}: PageProps<"/orders/[orderId]">) {
  const { orderId } = await params;
  return <OrderDetailView orderId={orderId} />;
}
