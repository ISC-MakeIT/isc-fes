import { withForm } from "@/shared/lib/form-hook";
import { toppingFormOptions } from "../model/topping-form";
import { Field, FieldContent, FieldError, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";

const inputStyle = "border border-primary rounded-sm";

export const ToppingFormFields = withForm({
  ...toppingFormOptions,
  render: ({ form }) => (
    <div className="flex w-full flex-col gap-6">
      <form.Field
        name="name"
        children={(field) => (
          <Field className="flex flex-col gap-2">
            <FieldLabel className="text-xl" htmlFor={field.name}>
              カスタマイズ名
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
          </Field>
        )}
      />

      <form.Field
        name="unitPrice"
        children={(field) => (
          <Field className="flex flex-col gap-2">
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
    </div>
  ),
});
