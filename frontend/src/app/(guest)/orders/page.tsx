import { OrderHistoryView } from "@/_pages/order-history";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "注文履歴",
};

export default function OrderPage() {
  return <OrderHistoryView />;
}
