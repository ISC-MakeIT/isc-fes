"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useStoreId } from "../model/hooks/use-store-id";
import { Menu, storeMenusQueryOptions } from "@/entities/menu";
import { editMenu, EditMenuInput } from "../api/edit-menu";
import { v } from "@/shared/lib/valibot";
import { storeMenusKey } from "@/shared/config";
import { HeadingCard } from "@/shared/ui/heading-card";
import { MenuFormFields } from "./menu-form-fields";
import { ActionButton } from "@/shared/ui/action-button";
import { EditorType, useMenuEditor } from "../model/menu-editor-context";
import { useAppForm } from "@/shared/lib/form-hook";
import { menuFormOptions, MenuFormValues } from "../model/menu-form";

type EditMenuFormProps = {
  menuId: string;
};

export function EditMenuForm({ menuId }: EditMenuFormProps) {
  const storeId = useStoreId();

  const { data: menus } = useSuspenseQuery(storeMenusQueryOptions(storeId));
  const menu = menus.find((menu) => menu.id === menuId);
  if (!menu) {
    return <p>このメニューは削除されたか、利用できなくなりました。</p>;
  }

  return <EditMenuFormContent menu={menu} storeId={storeId} />;
}

type EditMenuFormContentProps = {
  storeId: string;
  menu: Menu;
};

function EditMenuFormContent({ menu, storeId }: EditMenuFormContentProps) {
  const { setMenuEditor } = useMenuEditor();

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: editMenu,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storeMenusKey(storeId) });
      setMenuEditor([EditorType.Closed]);
    },
  });

  const initialValues: MenuFormValues = {
    name: menu.name,
    image: undefined,
    unitPrice: menu.unitPrice,
    description: menu.description,
  };

  const form = useAppForm({
    ...menuFormOptions,
    defaultValues: initialValues,
    validators: {
      ...menuFormOptions.validators,
      onSubmit: EditMenuInput,
    },
    onSubmit: async (values) => {
      const editMenuInput = v.parse(EditMenuInput, values);
      await mutation.mutateAsync({ storeId, menuId: menu.id, editMenuInput });
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
        <MenuFormFields form={form} initialImageUrl={menu.imageUrl} />

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
