import { StoreKitchenView } from "@/_pages/store-kitchen";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "キッチン",
};

export default function KitchenPage() {
  return <StoreKitchenView />;
}
