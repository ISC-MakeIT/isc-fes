"use client";

import { visibleStores } from "@/shared/config";
import { Card } from "@/shared/ui/card";
import { useQuery } from "@tanstack/react-query";
import { fetchVisibleStores } from "../api/fetchVisibleStores";
import { PreviewImage } from "@/shared/ui/preview-image";

export function StoreList() {
  const { data: stores } = useQuery({
    queryKey: visibleStores,
    queryFn: fetchVisibleStores,
  });

  return (
    <div>
      {stores?.map((store) => {
        return (
          <Card key={store.id}>
            <PreviewImage imagePath={store.imageUrl} />
          </Card>
        );
      })}
    </div>
  );
}
