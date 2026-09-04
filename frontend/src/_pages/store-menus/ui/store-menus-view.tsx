import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { storeMenusQueryOptions } from "@/entities/menu";
import { MenuEditor } from "./menu-editor";
import { MenuList } from "./menu-list";
import { createQueryClient } from "@/shared/api";
import { MenuEditorProvider } from "../model/menu-editor-context";

type StoreMenusViewProps = {
  storeId: string;
};

export async function StoreMenusView({ storeId }: StoreMenusViewProps) {
  const client = createQueryClient();
  await client.prefetchQuery(storeMenusQueryOptions(storeId));

  return (
    <MenuEditorProvider>
      <div className="grid grid-cols-[1fr_25rem]">
        <div className="px-4 pt-18">
          <HydrationBoundary state={dehydrate(client)}>
            <MenuList />
          </HydrationBoundary>
        </div>
        <MenuEditor />
      </div>
    </MenuEditorProvider>
  );
}
