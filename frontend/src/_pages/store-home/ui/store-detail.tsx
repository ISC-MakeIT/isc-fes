"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { storeDetailQueryOptions } from "../api/fetch-store-detail";
import { AspectRatio } from "@/shared/ui/aspect-ratio";
import Image from "next/image";

type StoreInfoProps = {
  storeId: string;
};

export function StoreInfo({ storeId }: StoreInfoProps) {
  const { data } = useSuspenseQuery(storeDetailQueryOptions(storeId));
  return (
    <div className="border-b-primary flex space-x-12 border-b px-10 py-4">
      <AspectRatio ratio={16 / 9} className="h-44">
        <Image
          fill
          className="object-cover"
          src={data.imageUrl}
          alt="店舗の画像"
        />
      </AspectRatio>
      <div className="flex flex-col space-y-6 py-4">
        <h1 className="text-xl font-bold">{data.name}</h1>
        <p className="">{data.description}</p>
      </div>
    </div>
  );
}
