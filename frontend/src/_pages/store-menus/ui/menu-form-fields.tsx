import { MenuFormValues } from "../model/types";
import { Field, FieldContent, FieldError, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { PreviewImage } from "@/shared/ui/preview-image";
import { Textarea } from "@/shared/ui/textarea";
import { MenuFormApi } from "../model/hooks/use-menu-form";
import { MENU_IMAGE_ASPECT } from "@/shared/config";

type MenuFormFieldsProps = {
  form: MenuFormApi;
};

export function MenuFormFields({ form }: MenuFormFieldsProps) {
  const inputStyle = "border border-primary rounded-sm";
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
                  className={inputStyle}
                  ratio={MENU_IMAGE_ASPECT}
                  imageFile={field.state.value}
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
                className={inputStyle}
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

      {/* TODO: トッピング */}
    </div>
  );
}
