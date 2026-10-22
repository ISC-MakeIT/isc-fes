import Image from "next/image";
import qrCode from "./assets/app-qr-code.png";

// リンク先を変更するときは、app-qr-code.pngも同じURLで再生成する。
const APP_URL = "https://fes.iwasaki.ac.jp/";

export function AppQrCode() {
  return (
    <a
      href={APP_URL}
      aria-label="学園祭アプリを開く"
      className="border-primary w-38 shrink-0 overflow-hidden rounded-sm border-4"
    >
      <p className="bg-primary -mx-px -mt-px py-1 text-center text-base leading-[1.2] text-white">
        学園祭アプリは
        <br />
        コチラ
      </p>
      <div className="bg-background p-4">
        <Image
          src={qrCode}
          alt="学園祭アプリのQRコード"
          width={112}
          height={112}
          unoptimized
        />
      </div>
    </a>
  );
}
