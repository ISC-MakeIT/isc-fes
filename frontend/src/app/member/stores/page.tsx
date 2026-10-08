import { StoresView } from "@/_pages/stores";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "所属店舗一覧",
};

export default function StorePage() {
  return <StoresView />;
}
