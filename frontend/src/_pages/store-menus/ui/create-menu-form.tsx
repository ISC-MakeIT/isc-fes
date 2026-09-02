import { HeadingCard } from "@/shared/ui/heading-card";
import { useMenuForm } from "../model/hooks/use-menu-form";
import { MenuFormFields } from "./menu-form-fields";
import { MenuFormValues } from "../model/types";
import { createMenu } from "../api/create-menu";
import { useMutation } from "@tanstack/react-query";
import { ActionButton } from "@/shared/ui/action-button";

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
  const mutation = useMutation({
    mutationFn: createMenu,
  });

  const form = useMenuForm({
    initialValues: defaultFormValue,
    requiresImage: true,
    onSubmit: async (values) => {
      mutation.mutate({ storeId, formValues: values });
    },
  });
  return (
    <div>
      <HeadingCard className="bg-secondary-heading-card">
        メニューの追加
      </HeadingCard>
      <form
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

        <ActionButton type="submit">メニューを追加</ActionButton>
      </form>
    </div>
  );
}
