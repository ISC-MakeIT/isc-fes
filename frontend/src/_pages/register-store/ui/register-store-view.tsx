import { HeadingCard } from "@/shared/ui/heading-card";
import { RegisterStoreForm } from "./register-store-form";
import { CenterLayout } from "@/shared/ui/center-layout";

export function RegisterStoreView() {
  return (
    <CenterLayout>
      <div className="space-y-4">
        <HeadingCard>店舗登録</HeadingCard>
        <p className="text-sm">
          この情報は、モバイルオーダーの画面にも使用されます
        </p>
      </div>
      <RegisterStoreForm />
      <p className="text-sm">
        登録内容は変更できません。変更したい場合は管理者に連絡してください。
      </p>
    </CenterLayout>
  );
}
