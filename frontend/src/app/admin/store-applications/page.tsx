import { StoreApplicationsView } from "@/_pages/store-applications";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "店舗申請管理",
};

export default function StoreApplicationsPage() {
  return <StoreApplicationsView />;
}
