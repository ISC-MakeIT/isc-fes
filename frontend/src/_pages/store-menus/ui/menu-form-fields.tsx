"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { MENU_IMAGE_ASPECT } from "@/shared/config";
import { withForm } from "@/shared/lib/form-hook";
import { cn } from "@/shared/lib/utils";
import { Field, FieldContent, FieldError, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { PreviewImage } from "@/shared/ui/preview-image";
import { Textarea } from "@/shared/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { storeToppingsQueryOptions } from "../api/fetch-store-toppings";
import { menuFormOptions, MenuFormValues } from "../model/menu-form";
import { useStoreId } from "../model/hooks/use-store-id";

type MenuFormFieldsProps = {
  initialImageUrl?: string;
};

const defaultMenuFormFieldProps: MenuFormFieldsProps = {};
const inputStyle = "border border-primary rounded-sm";

export const MenuFormFields = withForm({
  ...menuFormOptions,
  props: defaultMenuFormFieldProps,
  render: ({ form, initialImageUrl }) => {
    const storeId = useStoreId();
    const { data: toppings } = useSuspenseQuery(
      storeToppingsQueryOptions(storeId),
    );
    return (
      <div className="flex w-full flex-col gap-6">
        <form.Field
          name="name"
          validators={{ onChange: MenuFormValues.entries.name }}
          children={(field) => (
            <Field className="flex flex-col gap-2">
              <FieldLabel className="text-xl" htmlFor={field.name}>
                商品名
              </FieldLabel>
              <FieldContent>
                <Input
                  className={inputStyle}
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.isTouched && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </FieldContent>
              <p className="text-notice text-end text-sm">
                16文字以上は、省略される可能性があります
              </p>
            </Field>
          )}
        />

        <form.Field
          name="image"
          validators={{ onChange: MenuFormValues.entries.image }}
          children={(field) => (
            <Field>
              <FieldLabel className="text-xl" htmlFor={field.name}>
                商品画像
              </FieldLabel>
              <FieldContent>
                <label htmlFor={field.name} className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    id={field.name}
                    name={field.name}
                    className="sr-only"
                    onChange={(e) => field.handleChange(e.target.files?.[0])}
                    onBlur={field.handleBlur}
                  />
                  <PreviewImage
                    className={cn(inputStyle, "w-37.5 md:w-75")}
                    ratio={MENU_IMAGE_ASPECT}
                    imageFile={field.state.value}
                    imagePath={initialImageUrl}
                    alt="登録する商品画像"
                  />
                </label>

                {field.state.meta.isTouched && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </FieldContent>
            </Field>
          )}
        />

        <form.Field
          name="unitPrice"
          validators={{ onChange: MenuFormValues.entries.unitPrice }}
          children={(field) => (
            <Field>
              <FieldLabel className="text-xl" htmlFor={field.name}>
                値段
              </FieldLabel>
              <FieldContent>
                <Input
                  className={cn(inputStyle, "w-37.5")}
                  type="number"
                  id={field.name}
                  name={field.name}
                  value={field.state.value ?? ""}
                  onChange={(e) => {
                    const value = e.target.valueAsNumber;
                    field.handleChange(Number.isNaN(value) ? undefined : value);
                  }}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.isTouched && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </FieldContent>
            </Field>
          )}
        />

        <form.Field
          name="description"
          validators={{ onChange: MenuFormValues.entries.description }}
          children={(field) => (
            <Field>
              <FieldLabel className="text-xl" htmlFor={field.name}>
                商品説明
              </FieldLabel>
              <FieldContent>
                <Textarea
                  className={inputStyle}
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.isTouched && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </FieldContent>
            </Field>
          )}
        />

        <form.Field
          name="toppingIds"
          children={(field) => (
            <Field>
              <FieldLabel className="text-xl">カスタマイズ</FieldLabel>
              <p>
                {toppings.length === 0 ? (
                  <p>
                    カスタマイズが登録されていません
                    <br />
                    「カスタマイズの追加」から登録してください。
                  </p>
                ) : (
                  <p>
                    このメニューに適用可能なカスタマイズを選択してください。
                  </p>
                )}
              </p>
              <FieldContent>
                <ToggleGroup
                  multiple
                  value={field.state.value}
                  onValueChange={(toppingIds) => field.handleChange(toppingIds)}
                  onBlur={field.handleBlur}
                  className="flex w-full flex-col gap-4"
                >
                  {toppings.map((topping) => (
                    <ToggleGroupItem
                      key={topping.id}
                      value={topping.id}
                      className="border-tertiary data-pressed:bg-tertiary data-pressed:text-secondary-foreground h-auto w-full justify-start rounded-sm border-2 px-4 py-2 text-left wrap-break-word whitespace-normal"
                    >
                      {topping.name}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FieldContent>
            </Field>
          )}
        />
      </div>
    );
  },
});
