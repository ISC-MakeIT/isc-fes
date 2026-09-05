import Image from "next/image";
import appLogo from "../_assets/app-logo.svg";
import { DotText } from "@/shared/ui/dot-text";

export function GuestHeader() {
  return (
    <header className="bg-primary text-background grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-8 py-4 md:flex md:flex-row">
      <Image src={appLogo} alt={"アプリのロゴ"} className="justify-self-end" />
      <DotText className="text-[1.375rem]">アプリ名</DotText>
      <div aria-hidden="true" />
    </header>
  );
}
