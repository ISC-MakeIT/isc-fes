import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { storeMenusQueryOptions } from "@/entities/menu";
import { MenuEditor } from "./menu-editor";
import { MenuList } from "./menu-list";
import { createQueryClient } from "@/shared/api";
import { MenuEditorProvider } from "../model/menu-editor-context";
import { ToppingList } from "./topping-list";
import { storeToppingsQueryOptions } from "../api/fetch-store-toppings";

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
        <div className="grid grid-cols-[1fr_25rem]">
          <div className="space-y-20 px-4 py-18">
            <MenuList />
            <ToppingList />
          </div>
          <MenuEditor />
        </div>
      </MenuEditorProvider>
    </HydrationBoundary>
  );
}
