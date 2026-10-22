"use client";

import type { StoreRankingItem } from "@/entities/store";
import { cn } from "@/shared/lib/utils";
import Image from "next/image";
import { useState } from "react";
import rank1 from "./assets/rank-1.svg";
import rank2 from "./assets/rank-2.svg";
import rank3 from "./assets/rank-3.svg";
import imageNotch1 from "./assets/image-notch-1.svg";
import imageNotch2 from "./assets/image-notch-2.svg";
import imageNotch3 from "./assets/image-notch-3.svg";
import ribbonEnd1 from "./assets/ribbon-end-1.svg";
import ribbonEnd2 from "./assets/ribbon-end-2.svg";
import ribbonEnd3 from "./assets/ribbon-end-3.svg";
import chevronInner1 from "./assets/chevron-inner-1.svg";
import chevronInner2 from "./assets/chevron-inner-2.svg";
import chevronInner3 from "./assets/chevron-inner-3.svg";
import chevronOuter1 from "./assets/chevron-outer-1.svg";
import chevronOuter2 from "./assets/chevron-outer-2.svg";
import chevronOuter3 from "./assets/chevron-outer-3.svg";

const rankStyles = {
  1: {
    row: "h-[135px]",
    image: "w-60",
    name: "w-[431px] text-[28px]",
    number: "text-[64px]",
    badge: rank1,
    notch: imageNotch1,
    ribbonEnd: ribbonEnd1,
    chevronInner: chevronInner1,
    chevronOuter: chevronOuter1,
  },
  2: {
    row: "h-28",
    image: "w-50",
    name: "w-[403px] text-[26px]",
    number: "text-5xl",
    badge: rank2,
    notch: imageNotch2,
    ribbonEnd: ribbonEnd2,
    chevronInner: chevronInner2,
    chevronOuter: chevronOuter2,
  },
  3: {
    row: "h-22.5",
    image: "w-40",
    name: "w-[378px] text-2xl",
    number: "text-[32px]",
    badge: rank3,
    notch: imageNotch3,
    ribbonEnd: ribbonEnd3,
    chevronInner: chevronInner3,
    chevronOuter: chevronOuter3,
  },
} as const;

export function RankingRow({ store }: { store: StoreRankingItem }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const style = rankStyles[store.place];

  return (
    <li className={cn("flex items-center gap-2", style.row)}>
      <div className="relative flex h-full w-[135px] shrink-0 items-center justify-center">
        <img src={style.badge.src} alt="" className="max-w-none" />
        <span
          className={cn(
            "absolute leading-none font-bold text-white",
            style.number,
          )}
        >
          {store.place}
          <span className="sr-only">位</span>
        </span>
      </div>

      <div className="flex h-full shrink-0 items-center">
        <div
          className={cn("bg-muted relative h-full shrink-0", style.image)}
          style={{
            clipPath:
              "polygon(16.6667% 0, 100% 0, 100% 100%, 16.6667% 100%, 0 50%)",
          }}
        >
          {store.imageUrl && failedImageUrl !== store.imageUrl ? (
            <Image
              src={store.imageUrl}
              alt={`${store.name}の店舗画像`}
              fill
              sizes={`${store.place === 1 ? 240 : store.place === 2 ? 200 : 160}px`}
              className="object-cover"
              onError={() => setFailedImageUrl(store.imageUrl)}
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-base">
              画像なし
            </span>
          )}
          <img
            src={style.notch.src}
            alt=""
            className="absolute top-0 right-0 max-w-none"
          />
        </div>
        <div
          className={cn(
            "bg-primary flex h-full shrink-0 items-center px-8 py-2 text-white",
            style.name,
          )}
        >
          <p
            title={store.name}
            className="line-clamp-2 w-full leading-[1.2] break-words"
          >
            {store.name}
          </p>
        </div>
        <img src={style.ribbonEnd.src} alt="" className="max-w-none shrink-0" />
        <img
          src={style.chevronInner.src}
          alt=""
          className="max-w-none shrink-0"
        />
        <img
          src={style.chevronOuter.src}
          alt=""
          className="max-w-none shrink-0"
        />
      </div>
    </li>
  );
}
