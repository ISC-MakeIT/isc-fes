import { HeadingCard } from "@/shared/ui/heading-card";
import { useMenuForm } from "../model/hooks/use-menu-form";
import { MenuFormFields } from "./menu-form-fields";
import { MenuFormValues } from "../model/types";
import { createMenu } from "../api/create-menu";
import { useMutation } from "@tanstack/react-query";
import { ActionButton } from "@/shared/ui/action-button";
import { createQueryClient } from "@/shared/api";
import { storeMenusKey } from "@/shared/config";
import { useEffect } from "react";

const defaultFormValue: MenuFormValues = {
  name: "",
  image: undefined,
  unitPrice: 0,
  description: "",
};

type CreateMenuFormProps = {
  storeId: string;
};

export function CreateMenuForm({ storeId }: CreateMenuFormProps) {
  const client = createQueryClient();
  const mutation = useMutation({
    mutationFn: createMenu,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: storeMenusKey(storeId) });
    },
  });

  const form = useMenuForm({
    initialValues: defaultFormValue,
    requiresImage: true,
    onSubmit: async (values) => {
      await mutation.mutateAsync({ storeId, formValues: values });
    },
  });

  useEffect(() => {
    if (mutation.isSuccess) {
      form.reset();
    }
  }, [form, mutation.isSuccess]);

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
        <MenuFormFields form={form} />

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
          メニューを追加
        </ActionButton>
      </form>
    </div>
  );
}
