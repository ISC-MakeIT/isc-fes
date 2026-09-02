import { MenuFormValues } from "../model/types";
import { Field, FieldContent, FieldError, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { PreviewImage } from "@/shared/ui/preview-image";
import { Textarea } from "@/shared/ui/textarea";
import { MenuFormApi } from "../model/hooks/use-menu-form";

type MenuFormFieldsProps = {
  form: MenuFormApi;
};

export function MenuFormFields({ form }: MenuFormFieldsProps) {
  return (
    <>
      <form.Field
        name="name"
        validators={{ onChange: MenuFormValues.entries.name }}
        children={(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>商品名</FieldLabel>
            <FieldContent>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.isTouched && (
                <FieldError errors={field.state.meta.errors} />
              )}
              <p>16文字以上は省略される可能性があります</p>
            </FieldContent>
          </Field>
        )}
      />

      <form.Field
        name="image"
        validators={{ onChange: MenuFormValues.entries.image }}
        children={(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>商品画像</FieldLabel>
            <FieldContent>
              <label htmlFor={field.name} className="cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  id={field.name}
                  name={field.name}
                  onChange={(e) => field.handleChange(e.target.files?.[0])}
                  onBlur={field.handleBlur}
                />
                <PreviewImage imageFile={field.state.value} />
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
            <FieldLabel htmlFor={field.name}>値段</FieldLabel>
            <FieldContent>
              <Input
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
            <FieldLabel htmlFor={field.name}>商品説明</FieldLabel>
            <FieldContent>
              <Textarea
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
    </>
  );
}
