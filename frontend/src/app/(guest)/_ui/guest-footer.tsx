import Image from "next/image";
import appLogo from "@/shared/assets/app-logo.svg";
import { DotText } from "@/shared/ui/dot-text";
import Link from "next/link";
import { homeUrl, ordersUrl } from "@/shared/config";

export function GuestFooter() {
  const linkStyle = "border-background border-b px-2 text-xl";
  return (
    <footer className="bg-primary text-background flex flex-col items-center px-2.5 pt-10 pb-6">
      <div className="space-y-30">
        <div className="space-y-10">
          <div className="flex flex-row items-center justify-center">
            <Image src={appLogo} alt={"アプリのロゴ"} />
            <DotText className="text-[1.375rem]">アプリ名</DotText>
          </div>
          <nav className="flex flex-col items-center gap-4">
            <Link className={linkStyle} href={homeUrl()}>
              <DotText>マップ</DotText>
            </Link>
            <Link className={linkStyle} href={ordersUrl()}>
              <DotText>注文履歴</DotText>
            </Link>
          </nav>
        </div>
        <small>&copy;2026学園祭アプリ制作委員会（仮）</small>
      </div>
    </footer>
  );
}
