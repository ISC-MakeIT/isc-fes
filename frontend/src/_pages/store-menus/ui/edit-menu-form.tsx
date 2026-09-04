"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useStoreId } from "../model/hooks/use-store-id";
import { storeMenusQueryOptions } from "@/entities/menu";
import { editMenu } from "../api/edit-menu";
import { v } from "@/shared/lib/valibot";
import { EditMenuInput } from "../model/types";
import { useMenuForm } from "../model/hooks/use-menu-form";
import { storeMenusKey } from "@/shared/config";
import { HeadingCard } from "@/shared/ui/heading-card";
import { MenuFormFields } from "./menu-form-fields";
import { ActionButton } from "@/shared/ui/action-button";
import { EditorType, useMenuEditor } from "../model/menu-editor-context";

type EditMenuFormProps = {
  menuId: string;
};

export function EditMenuForm({ menuId }: EditMenuFormProps) {
  const storeId = useStoreId();
  const { setMenuEditor } = useMenuEditor();

  const { data: menus } = useSuspenseQuery(storeMenusQueryOptions(storeId));
  const targetMenu = menus.find((menu) => menu.id === menuId);
  if (!targetMenu) {
    return <p>このメニューは削除されたか、利用できなくなりました。</p>;
  }

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: editMenu,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storeMenusKey(storeId) });
      setMenuEditor([EditorType.Closed]);
    },
  });

  const form = useMenuForm({
    submitSchema: EditMenuInput,
    initialValues: {
      name: targetMenu.name,
      image: undefined,
      unitPrice: targetMenu.unitPrice,
      description: targetMenu.description,
    },
    onSubmit: async (values) => {
      const editMenuInput = v.parse(EditMenuInput, values);
      await mutation.mutateAsync({ storeId, menuId, editMenuInput });
    },
  });

  return (
    <div className="space-y-10">
      <HeadingCard className="bg-secondary-heading-card px-8 py-4">
        メニューの追加
      </HeadingCard>
      <form
        className="flex flex-col items-center gap-10"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <MenuFormFields form={form} initialImageUrl={targetMenu.imageUrl} />

        {mutation.error && (
          <p role="alert" className="text-notice">
            {mutation.error.message}
          </p>
        )}

        <ActionButton
          disabled={mutation.isPending}
          type="submit"
          className="px-14 py-4 text-xl"
        >
          保存する
        </ActionButton>
      </form>
    </div>
  );
}
