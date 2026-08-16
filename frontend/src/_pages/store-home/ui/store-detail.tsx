"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { storeDetailQueryOptions } from "../api/fetch-store-detail";

type StoreInfoProps = {
  storeId: string;
};

export function StoreInfo({ storeId }: StoreInfoProps) {
  const { data } = useSuspenseQuery(storeDetailQueryOptions(storeId));
  return (
    <>
      <p>{data.name}</p>
    </>
  );
}
