import Image from "next/image";
import appLogo from "./assets/app-logo.svg";
import homeIcon from "./assets/home-icon.svg";
import { DotText } from "@/shared/ui/dot-text";
import Link from "next/link";
import {
  ACCOUNT_SESSION_COOKIE_NAME,
  homeUrl,
  storeListUrl,
} from "@/shared/config";
import { cookies } from "next/headers";
import { GuestStoreCallLink } from "./guest-store-call-link";

export async function GuestHeader() {
  // 可用性やAPIコストを考えて、ここでは実APIを叩かずcookieの有無のみを見る
  // セッションの検証はリダイレクト先で行う想定
  const cookiesStore = await cookies();
  const hasAccountSession = cookiesStore.has(ACCOUNT_SESSION_COOKIE_NAME);
  return (
    <header className="bg-primary text-background flex flex-row items-center justify-between px-4 py-4 sm:px-6">
      <Link href={homeUrl()} className="flex flex-row gap-1">
        <Image src={appLogo} alt="" draggable={false} />
        <DotText className="text-[1.375rem]">ふぇすNavi</DotText>
      </Link>

      {hasAccountSession && (
        <nav
          aria-label="店舗メニュー"
          className="flex flex-row items-center gap-2 sm:gap-4"
        >
          <GuestStoreCallLink />
          <Link
            href={storeListUrl()}
            className="flex flex-row items-center gap-2"
          >
            <Image src={homeIcon} alt="" draggable={false} />
            <p className="text-sm">店舗へ</p>
          </Link>
        </nav>
      )}
    </header>
  );
}
