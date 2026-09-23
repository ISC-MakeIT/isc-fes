import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { storeMenusQueryOptions } from "@/entities/menu";
import { MenuEditor } from "./menu-editor";
import { createQueryClient } from "@/shared/api";
import { MenuEditorProvider } from "../model/menu-editor-context";
import { storeToppingsQueryOptions } from "../api/fetch-store-toppings";
import { MenuCatalog } from "./menu-catalog";

type StoreMenusViewProps = {
  storeId: string;
};

export async function StoreMenusView({ storeId }: StoreMenusViewProps) {
  const client = createQueryClient();
  await Promise.all([
    client.prefetchQuery(storeMenusQueryOptions(storeId)),
    client.prefetchQuery(storeToppingsQueryOptions(storeId)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(client)}>
      <MenuEditorProvider>
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_25rem] lg:justify-center">
          <div className="w-full max-w-150 justify-self-center">
            <MenuCatalog />
          </div>
          <MenuEditor />
        </div>
      </MenuEditorProvider>
    </HydrationBoundary>
  );
}
