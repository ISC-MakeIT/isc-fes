"use client";

import { HeadingCard } from "@/shared/ui/heading-card";
import Image from "next/image";
import { useState } from "react";
import { DotText } from "@/shared/ui/dot-text";
import { cn } from "@/shared/lib/utils";
import floor1Image from "./assets/floor-1f.svg";
import floor5Image from "./assets/floor-5f.svg";
import floor6Image from "./assets/floor-6f.svg";
import floor7Image from "./assets/floor-7f.svg";
import floor8Image from "./assets/floor-8f.svg";
import type { StaticImageData } from "next/image";
import { Floor } from "../model/types";
import { useSuspenseQuery } from "@tanstack/react-query";
import { visibleStoresQueryOptions } from "@/entities/store";
import { selectFloorGuideStores } from "../lib/selectFloorGuideStores";
import { PreviewImage } from "@/shared/ui/preview-image";
import { STORE_IMAGE_ASPECT } from "@/shared/config";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

export type Floors = {
  level: Floor;
  label: string;
  image: StaticImageData;
}[];

export const floors: Floors = [
  { level: 8, label: "８階", image: floor8Image },
  { level: 7, label: "７階", image: floor7Image },
  { level: 6, label: "６階", image: floor6Image },
  { level: 5, label: "５階", image: floor5Image },
  { level: 1, label: "１階", image: floor1Image },
];

export function FloorGuide() {
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(
    floors.at(-1)?.level ?? null,
  );
  return (
    <section className="flex w-full flex-col items-center gap-16 pt-8 pb-16">
      <HeadingCard className="px-14 py-2">フロアガイド</HeadingCard>
      <div className="flex flex-col items-center gap-6">
        <p className="text-lg">
          <DotText>フロアを選択してください</DotText>
        </p>
        <ul className="flex flex-col">
          {floors.map((floor) => (
            <li className="flex flex-row items-center gap-14" key={floor.level}>
              <div className="space-x-4">
                <span
                  className={cn(
                    "text-2xl",
                    selectedFloor !== floor.level && "opacity-0",
                  )}
                >
                  ▶︎
                </span>
                <label
                  htmlFor={floor.level.toString()}
                  className="cursor-pointer text-xl underline underline-offset-4"
                >
                  <DotText>{floor.label}</DotText>
                </label>
              </div>
              <button
                id={floor.level.toString()}
                aria-pressed={selectedFloor === floor.level}
                className={cn(
                  "h-[2.8293rem] cursor-pointer transition-transform",
                  selectedFloor === floor.level &&
                    "-translate-x-5 translate-y-3",
                )}
                style={{ zIndex: floor.level }}
                onClick={() => setSelectedFloor(floor.level)}
              >
                <Image
                  src={floor.image}
                  alt={"フロア"}
                  className="w-33.5"
                  draggable={false}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {selectedFloor && <FloorStoreList floor={selectedFloor} />}
    </section>
  );
}

type FloorStoreListProps = {
  floor: Floor;
};

function FloorStoreList({ floor }: FloorStoreListProps) {
  const { data: stores } = useSuspenseQuery({
    ...visibleStoresQueryOptions(),
    // visibleStoreは店舗側でも使うので呼び出し側からstaleTimeを設定
    staleTime: Infinity,
  });
  const storesByFloor = selectFloorGuideStores(stores, floor);

  return (
    <div className="flex w-full flex-col items-center px-4">
      {storesByFloor.map((store) => (
        <Link
          href=""
          key={store.id}
          className="border-foreground flex w-full flex-row items-center gap-2 border-b border-dashed px-2 py-4 lg:max-w-115.5"
        >
          <PreviewImage
            ratio={STORE_IMAGE_ASPECT}
            alt={`${store.name}の店舗画像`}
            imagePath={store.imageUrl}
            className="w-28"
          />
          <div>
            <p className="text-lg">{store.name}</p>
          </div>
          <ChevronRightIcon strokeWidth={0.5} className="ml-auto" size={40} />
        </Link>
      ))}
    </div>
  );
}
