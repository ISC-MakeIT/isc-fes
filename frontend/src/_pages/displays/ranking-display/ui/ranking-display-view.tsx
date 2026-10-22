"use client";

import { useEffect, useRef, useState } from "react";
import { Inter, Mochiy_Pop_One } from "next/font/google";
import { cn } from "@/shared/lib/utils";
import { RankingList } from "./ranking-list";
import { DisplayEvents } from "./display-events";
import { AppQrCode } from "./app-qr-code";
import awning from "./assets/awning.svg";

const headingFont = Mochiy_Pop_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const bodyFont = Inter({ subsets: ["latin"], display: "swap" });

type RankingDisplayViewProps = {
  initialDateTime: string;
};

export function RankingDisplayView({
  initialDateTime,
}: RankingDisplayViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // 中身の縦横比と帯の高さを保ち、画面内に収まる倍率にする。
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setScale(
        Math.min(
          entry.contentRect.width / 1280,
          entry.contentRect.height / 720,
        ),
      );
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={viewportRef}
      className={cn(
        "bg-background text-foreground fixed inset-0 flex flex-col overflow-hidden",
        bodyFont.className,
      )}
    >
      <div
        aria-hidden
        className="w-full shrink-0 overflow-hidden"
        style={{ height: 100 * scale }}
      >
        <img src={awning.src} alt="" className="h-full w-full object-fill" />
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <main
          className="grid h-141 w-320 shrink-0 origin-center grid-cols-[minmax(0,1fr)_363px] pr-7.5 pl-8"
          style={{ transform: `scale(${scale})` }}
        >
          <section aria-labelledby="ranking-heading" className="min-w-0">
            <h1
              id="ranking-heading"
              className={cn(
                "text-primary flex h-30.5 items-center text-[40px] leading-normal",
                headingFont.className,
              )}
            >
              売り上げランキング!!
            </h1>
            <RankingList />
          </section>

          <aside
            aria-label="学園祭のご案内"
            className="flex flex-col items-end gap-3.5 pt-[111px]"
          >
            <AppQrCode />
            <DisplayEvents initialDateTime={initialDateTime} />
          </aside>
        </main>
      </div>

      <div
        aria-hidden
        className="bg-primary w-full shrink-0"
        style={{ height: 56 * scale }}
      />
    </div>
  );
}
