"use client";

import { useForm } from "@tanstack/react-form";
import { CreateStoreForm } from "../model/types";
import { createStoreApplication } from "../api/craete-store-application";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Field, FieldError, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";

const defaultFormValue: CreateStoreForm = {
  name: "",
  room: "",
  description: "",
  image: undefined,
};

export function RegisterStoreForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: defaultFormValue,
    onSubmit: async ({ value }) => {
      const { error } = await createStoreApplication(value);
      // TODO: 新規作成が成功したら完了ページにリダイレクト
      setServerError(error ? error : null);
    },
  });

  return (
    <>
      {serverError && <FieldError>{serverError}</FieldError>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Subscribe
          selector={(state) => state.errorMap.onServer}
          children={(error) =>
            error ? <FieldError errors={[{ message: error }]} /> : null
          }
        />

        <form.Field
          name="name"
          validators={{ onChange: CreateStoreForm.entries.name }}
          children={(field) => (
            <>
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor={field.name}>店舗名</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            </>
          )}
        />
        <form.Field
          name="room"
          validators={{ onChange: CreateStoreForm.entries.room }}
          children={(field) => (
            <>
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor={field.name}>教室</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            </>
          )}
        />
        <form.Field
          name="description"
          validators={{ onChange: CreateStoreForm.entries.description }}
          children={(field) => (
            <>
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor={field.name}>店舗説明</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            </>
          )}
        />

        <form.Field
          name="image"
          validators={{ onChange: CreateStoreForm.entries.image }}
          children={(field) => (
            <>
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor={field.name}>店舗説明</FieldLabel>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  id={field.name}
                  name={field.name}
                  onChange={(e) => field.handleChange(e.target.files?.[0])}
                  onBlur={field.handleBlur}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            </>
          )}
        />

        <form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isPristine,
            state.isSubmitted,
          ]}
          children={([canSubmit, isPristine, isSubmitted]) => (
            <Button type="submit" disabled={!canSubmit || isPristine}>
              {isSubmitted ? "送信完了" : "この内容で送信"}
            </Button>
          )}
        />
      </form>
    </>
  );
}
