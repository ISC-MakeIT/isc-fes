import { HeadingCard } from "@/shared/ui/heading-card";
import { RegisterStoreForm } from "./register-store-form";
import { CenterLayout } from "@/shared/ui/center-layout";

export function RegisterStoreView() {
  return (
    <CenterLayout className="text-center">
      <HeadingCard>店舗登録</HeadingCard>
      <p className="text-sm">
        この情報は、モバイルオーダーの画面にも使用されます
      </p>
      <RegisterStoreForm />
    </CenterLayout>
  );
}
