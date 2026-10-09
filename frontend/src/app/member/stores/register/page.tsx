import { RegisterStoreView } from "@/_pages/register-store";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "店舗登録",
};

export default function RegisterStorePage() {
  return <RegisterStoreView />;
}
