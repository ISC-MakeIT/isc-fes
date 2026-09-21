"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useStoreId } from "../model/hooks/use-store-id";
import { storeToppingsQueryOptions } from "../api/fetch-store-toppings";
import { editTopping } from "../api/edit-topping";
import { storeToppingsKey } from "@/shared/config";
import { EditorType, useMenuEditor } from "../model/menu-editor-context";
import {
  CompleteToppingFormValues,
  toppingFormOptions,
  ToppingFormValues,
} from "../model/topping-form";
import { useAppForm } from "@/shared/lib/form-hook";
import { v } from "@/shared/lib/valibot";
import { HeadingCard } from "@/shared/ui/heading-card";
import { ToppingFormFields } from "./topping-form-fields";
import { ActionButton } from "@/shared/ui/action-button";
import { Topping } from "@/entities/topping";
import { DeleteItemButton } from "./delete-item-button";
import { deleteTopping } from "../api/delete-topping";
import { pickChangedFields } from "../lib/pick-changed-fields";
import { useState } from "react";

type EditToppingFormProps = {
  toppingId: string;
};

export function EditToppingForm({ toppingId }: EditToppingFormProps) {
  const storeId = useStoreId();

  const { data: toppings } = useSuspenseQuery(
    storeToppingsQueryOptions(storeId),
  );
  const topping = toppings.find((i) => i.id === toppingId);
  if (!topping) {
    throw new Error("カスタマイズは削除されたか利用できなくなりました。");
  }

  // 条件つきフックを回避するために別コンポーネントに分けている
  return <EditToppingFormContent storeId={storeId} topping={topping} />;
}

type EditToppingFormContentProps = {
  storeId: string;
  topping: Topping;
};

function EditToppingFormContent({
  storeId,
  topping,
}: EditToppingFormContentProps) {
  const { setMenuEditor } = useMenuEditor();

  const queryClient = useQueryClient();
  const editToppingMutation = useMutation({
    mutationFn: editTopping,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storeToppingsKey(storeId) });
      setMenuEditor([EditorType.Closed]);
    },
  });

  const deleteToppingMutation = useMutation({
    mutationFn: deleteTopping,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storeToppingsKey(storeId) });
      setMenuEditor([EditorType.Closed]);
    },
  });

  const [initialValues] = useState<ToppingFormValues>({
    name: topping.name,
    unitPrice: topping.unitPrice,
  });

  const form = useAppForm({
    ...toppingFormOptions,
    defaultValues: initialValues,

    onSubmit: async ({ value, formApi }) => {
      if (formApi.state.isDefaultValue) return;

      const currentValues = v.parse(CompleteToppingFormValues, value);

      await editToppingMutation.mutateAsync({
        storeId,
        toppingId: topping.id,
        editToppingInput: pickChangedFields({ initialValues, currentValues }),
      });
    },
  });

  return (
    <div className="space-y-10">
      <HeadingCard className="bg-secondary-heading-card px-8 py-4">
        カスタマイズの編集
      </HeadingCard>
      <form
        className="flex flex-col items-center gap-10"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <ToppingFormFields form={form} />

        {editToppingMutation.error && (
          <p role="alert" className="text-notice">
            {editToppingMutation.error.message}
          </p>
        )}

        <div className="flex flex-col items-center gap-8">
          <form.Subscribe selector={(state) => [state.isDefaultValue]}>
            {([isDefaultValue]) => (
              <ActionButton
                disabled={editToppingMutation.isPending || isDefaultValue}
                type="submit"
                className="px-14 py-4 text-xl"
              >
                保存する
              </ActionButton>
            )}
          </form.Subscribe>
          <DeleteItemButton
            disabled={deleteToppingMutation.isPending}
            dialogContent={
              <>
                上記のカスタマイズを<span className="text-notice">削除</span>
                しますか？
              </>
            }
            buttonLabel="カスタマイズを削除"
            errorMessage={deleteToppingMutation.error?.message}
            deleteFunction={() =>
              deleteToppingMutation.mutate({ toppingId: topping.id, storeId })
            }
            itemName={topping.name}
          />
        </div>
      </form>
    </div>
  );
}
