"use client";

import { PreviewImage } from "@/_pages/register-store/ui/preview-image";
import { visibleStores } from "@/shared/config";
import { Card } from "@/shared/ui/card";
import { useQuery } from "@tanstack/react-query";
import { fetchVisibleStores } from "../api/fetchVisibleStores";

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
