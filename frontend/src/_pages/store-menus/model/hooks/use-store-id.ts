"use client";

import { useParams } from "next/navigation";

export function useStoreId(): string {
  const params = useParams();
  const storeId = params.storeId;

  if (typeof storeId !== "string" || storeId.length === 0) {
    throw new Error("URLにstoreIdが含まれていません");
  }

  return storeId;
}
