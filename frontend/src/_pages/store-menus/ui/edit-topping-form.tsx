"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useStoreId } from "../model/hooks/use-store-id";
import { storeToppingsQueryOptions } from "../api/fetch-store-toppings";
import { editTopping, EditToppingInput } from "../api/edit-topping";
import { storeToppingsKey } from "@/shared/config";
import { EditorType, useMenuEditor } from "../model/menu-editor-context";
import { toppingFormOptions, ToppingFormValues } from "../model/topping-form";
import { useAppForm } from "@/shared/lib/form-hook";
import { v } from "@/shared/lib/valibot";
import { HeadingCard } from "@/shared/ui/heading-card";
import { ToppingFormFields } from "./topping-form-fields";
import { ActionButton } from "@/shared/ui/action-button";

type EditToppingFormProps = {
  toppingId: string;
};

export function EditToppingForm({ toppingId }: EditToppingFormProps) {
  const storeId = useStoreId();
  const { setMenuEditor } = useMenuEditor();

  const { data: toppings } = useSuspenseQuery(
    storeToppingsQueryOptions(storeId),
  );

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: editTopping,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storeToppingsKey(storeId) });
      setMenuEditor([EditorType.Closed]);
    },
  });

  const topping = toppings.find((i) => i.id === toppingId);
  if (!topping) {
    throw new Error("カスタマイズは削除されたか利用できなくなりました。");
  }

  const initialValues: ToppingFormValues = {
    name: topping.name,
    unitPrice: topping.unitPrice,
  };

  const form = useAppForm({
    ...toppingFormOptions,
    defaultValues: initialValues,

    onSubmit: async ({ value, formApi }) => {
      if (formApi.state.isDefaultValue) return;

      const editToppingInput = v.parse(EditToppingInput, {
        ...value,
        // API側は必須で要求しているので今の状態をそのまま詰めて渡す
        soldOut: topping.soldOut,
      });
      await mutation.mutateAsync({
        storeId,
        toppingId: topping.id,
        editToppingInput,
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

        {mutation.error && (
          <p role="alert" className="text-notice">
            {mutation.error.message}
          </p>
        )}

        <form.Subscribe selector={(state) => [state.isDefaultValue]}>
          {([isDefaultValue]) => (
            <ActionButton
              disabled={mutation.isPending || isDefaultValue}
              type="submit"
              className="px-14 py-4 text-xl"
            >
              保存する
            </ActionButton>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
