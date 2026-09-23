"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useStoreId } from "../model/hooks/use-store-id";
import { Menu, storeMenusQueryOptions } from "@/entities/menu";
import { editMenu } from "../api/edit-menu";
import { v } from "@/shared/lib/valibot";
import { storeMenusKey } from "@/shared/config";
import { HeadingCard } from "@/shared/ui/heading-card";
import { MenuFormFields } from "./menu-form-fields";
import { ActionButton } from "@/shared/ui/action-button";
import { useAppForm } from "@/shared/lib/form-hook";
import {
  CompleteEditMenuFormValues,
  menuFormOptions,
  MenuFormValues,
} from "../model/menu-form";
import { deleteMenu } from "../api/delete-menu";
import { DeleteItemButton } from "./delete-item-button";
import { pickChangedFields } from "../lib/pick-changed-fields";
import { useRef } from "react";
import { useMenuEditor } from "../model/hooks/use-menu-editor";

type EditMenuFormProps = {
  menuId: string;
};

export function EditMenuForm({ menuId }: EditMenuFormProps) {
  const storeId = useStoreId();

  const { data: menus } = useSuspenseQuery(storeMenusQueryOptions(storeId));
  const menu = menus.find((menu) => menu.id === menuId);
  if (!menu) {
    throw new Error("このメニューは削除されたか、利用できなくなりました。");
  }

  return <EditMenuFormContent menu={menu} storeId={storeId} />;
}

type EditMenuFormContentProps = {
  storeId: string;
  menu: Menu;
};

function EditMenuFormContent({ menu, storeId }: EditMenuFormContentProps) {
  const { closeEditor } = useMenuEditor();

  const queryClient = useQueryClient();
  const editMenuMutation = useMutation({
    mutationFn: editMenu,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storeMenusKey(storeId) });
      closeEditor();
    },
  });

  const deleteMenuMutation = useMutation({
    mutationFn: deleteMenu,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storeMenusKey(storeId) });
      closeEditor();
    },
  });

  const initialValues = useRef<MenuFormValues>({
    name: menu.name,
    image: undefined,
    unitPrice: menu.unitPrice,
    description: menu.description,
  });

  const form = useAppForm({
    ...menuFormOptions,
    validators: {
      onMount: CompleteEditMenuFormValues,
      onChange: CompleteEditMenuFormValues,
      onSubmit: CompleteEditMenuFormValues,
    },
    defaultValues: initialValues.current,
    onSubmit: async ({ value, formApi }) => {
      if (formApi.state.isDefaultValue) return;

      const currentValues = v.parse(CompleteEditMenuFormValues, value);

      await editMenuMutation.mutateAsync({
        storeId,
        menuId: menu.id,
        editMenuInput: pickChangedFields({
          initialValues: initialValues.current,
          currentValues,
        }),
      });
    },
  });

  return (
    <div className="space-y-10">
      <HeadingCard className="bg-secondary-heading-card px-8 py-4">
        メニューの編集
      </HeadingCard>
      <form
        className="flex flex-col items-center gap-10"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <MenuFormFields form={form} initialImageUrl={menu.imageUrl} />

        {editMenuMutation.error && (
          <p role="alert" className="text-notice">
            {editMenuMutation.error.message}
          </p>
        )}

        <div className="flex flex-col items-center gap-8">
          <form.Subscribe selector={(state) => [state.isDefaultValue]}>
            {([isDefaultValue]) => (
              <ActionButton
                disabled={editMenuMutation.isPending || isDefaultValue}
                type="submit"
                className="px-14 py-4 text-xl"
              >
                保存する
              </ActionButton>
            )}
          </form.Subscribe>

          <DeleteItemButton
            disabled={deleteMenuMutation.isPending}
            dialogContent={
              <>
                上記のメニューを<span className="text-notice">削除</span>
                しますか？
              </>
            }
            errorMessage={deleteMenuMutation.error?.message}
            buttonLabel="メニューを削除"
            deleteFunction={() =>
              deleteMenuMutation.mutate({ menuId: menu.id, storeId })
            }
            itemName={menu.name}
          />
        </div>
      </form>
    </div>
  );
}
