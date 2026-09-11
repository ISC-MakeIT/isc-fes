import Image from "next/image";
import appLogo from "./assets/app-logo.svg";
import homeLogo from "./assets/home-icon.svg";
import { DotText } from "@/shared/ui/dot-text";
import Link from "next/link";
import { storeListUrl } from "@/shared/config";
import { fetchCurrentAccount } from "@/entities/account";

export async function GuestHeader() {
  const account = await fetchCurrentAccount();
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

      {account && (
        <Link href={storeListUrl()} className="flex flex-row gap-2">
          <Image src={homeLogo} alt="ストアのロゴ" />
          <p className="text-sm">店舗へ</p>
        </Link>
      )}
    </header>
  );
}
