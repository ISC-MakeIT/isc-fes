import { HeadingCard } from "@/shared/ui/heading-card";
import { RegisterStoreForm } from "./register-store-form";

export function RegisterStoreView() {
  return (
    <div className="mx-6 my-8 flex flex-col space-y-8 sm:mx-32">
      <div className="flex flex-col items-center space-y-4">
        <HeadingCard>店舗登録</HeadingCard>
        <p className="text-sm">
          この情報は、モバイルオーダーの画面にも使用されます
        </p>
      </div>
      <RegisterStoreForm />
      <p className="text-center text-sm">
        登録内容は変更できません。変更したい場合は管理者に連絡してください。
      </p>
    </div>
  );
}
