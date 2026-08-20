"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { storeDetailQueryOptions } from "../api/fetch-store-detail";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { STORE_IMAGE_ASPECT } from "@/shared/config";

type StoreInfoProps = {
  storeId: string;
};

export function StoreInfo({ storeId }: StoreInfoProps) {
  const { data: store } = useSuspenseQuery(storeDetailQueryOptions(storeId));
  return (
    <div className="border-b-primary flex flex-col items-center gap-12 border-b px-10 py-4 md:flex-row">
      <AspectRatioImage
        className="mx-auto w-full md:w-80 md:shrink-0"
        ratio={STORE_IMAGE_ASPECT}
        src={store.imageUrl}
        alt="店舗の画像"
      />

      <div className="flex flex-col space-y-6 py-4">
        <h1 className="text-xl font-bold">{store.name}</h1>
        <p className="">{store.description}</p>
      </div>
    </div>
  );
}
