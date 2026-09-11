import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStoreId } from "../model/hooks/use-store-id";
import { createTopping, CreateToppingInput } from "../api/create-topping";
import { storeToppingsKey } from "@/shared/config";
import { useAppForm } from "@/shared/lib/form-hook";
import { toppingFormOptions } from "../model/topping-form";
import { v } from "@/shared/lib/valibot";
import { HeadingCard } from "@/shared/ui/heading-card";
import { ToppingFormFields } from "./topping-form-fields";
import { ActionButton } from "@/shared/ui/action-button";

export function CreateToppingForm() {
  const storeId = useStoreId();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: createTopping,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: storeToppingsKey(storeId) });
      form.reset();
    },
  });

  const form = useAppForm({
    ...toppingFormOptions,
    validators: {
      ...toppingFormOptions.validators,
      onSubmit: CreateToppingInput,
    },

    onSubmit: async ({ value }) => {
      const createToppingInput = v.parse(CreateToppingInput, value);
      await mutation.mutateAsync({ storeId, createToppingInput });
    },
  });

  return (
    <div className="space-y-10">
      <HeadingCard className="bg-secondary-heading-card px-8 py-4">
        カスタマイズの追加
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

        <ActionButton
          disabled={mutation.isPending}
          type="submit"
          className="px-14 py-4 text-xl"
        >
          カスタマイズを追加
        </ActionButton>
      </form>
    </div>
  );
}
