import Image from "next/image";
import appLogo from "./assets/app-logo.svg";
import homeLogo from "./assets/home-icon.svg";
import { DotText } from "@/shared/ui/dot-text";
import Link from "next/link";
import { ACCOUNT_SESSION_COOKIE_NAME, storeListUrl } from "@/shared/config";
import { cookies } from "next/headers";

export async function GuestHeader() {
  // 可用性やAPIコストを考えて、ここでは実APIを叩かずcookieの有無のみを見る
  // セッションの検証はリダイレクト先で行う想定
  const cookiesStore = await cookies();
  const hasAccountSession = cookiesStore.has(ACCOUNT_SESSION_COOKIE_NAME);
  return (
    <header className="bg-primary text-background flex flex-row items-center justify-between px-6 py-4">
      <div className="flex flex-row gap-1">
        <Image
          src={appLogo}
          alt={"アプリのロゴ"}
          className="justify-self-end"
        />
        <DotText className="text-[1.375rem]">アプリ名</DotText>
      </div>

      {hasAccountSession && (
        <Link href={storeListUrl()} className="flex flex-row gap-2">
          <Image src={homeLogo} alt="" />
          <p className="text-sm">店舗へ</p>
        </Link>
      )}
    </header>
  );
}
