"use client";

import { useForm } from "@tanstack/react-form";
import { CreateStoreForm, CreateStoreFormImage } from "../model/types";
import { createStoreApplication } from "../api/create-store-application";
import { useState } from "react";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { STORE_LIST_URL } from "@/shared/config";
import { Textarea } from "@/shared/ui/textarea";
import { PreviewImage } from "@/shared/ui/preview-image";
import { SubmitButton } from "@/shared/ui/submit-button";
import { useRouter } from "next/navigation";

const defaultFormValue: CreateStoreForm = {
  name: "",
  room: "",
  description: "",
  image: undefined,
};

export function RegisterStoreForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: defaultFormValue,
    validators: {
      onMount: CreateStoreForm,
    },
    onSubmit: async ({ value }) => {
      const { data, error } = await createStoreApplication(value);

      if (data) {
        router.push(STORE_LIST_URL);
        return;
      }

      setServerError(error);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <div className="flex flex-col items-start gap-y-6">
        <form.Field
          name="name"
          validators={{ onChange: CreateStoreForm.entries.name }}
          children={(field) => (
            <FieldGroup>
              <Field
                orientation="responsive"
                data-invalid={
                  field.state.meta.isTouched && !field.state.meta.isValid
                }
              >
                <FieldLabel htmlFor={field.name}>店舗名</FieldLabel>
                <FieldContent>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  <FieldError
                    errors={
                      field.state.meta.isTouched ? field.state.meta.errors : []
                    }
                  />
                </FieldContent>
              </Field>
            </FieldGroup>
          )}
        />
        <form.Field
          name="room"
          validators={{ onChange: CreateStoreForm.entries.room }}
          children={(field) => (
            <FieldGroup>
              <Field
                orientation="responsive"
                data-invalid={
                  field.state.meta.isTouched && !field.state.meta.isValid
                }
              >
                <FieldLabel htmlFor={field.name}>教室</FieldLabel>
                <FieldContent>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    onBlur={field.handleBlur}
                  />
                  <FieldError
                    errors={
                      field.state.meta.isTouched ? field.state.meta.errors : []
                    }
                  />
                </FieldContent>
              </Field>
            </FieldGroup>
          )}
        />

        <form.Field
          name="image"
          validators={{
            onChange: CreateStoreFormImage,
            onMount: CreateStoreFormImage,
            onSubmit: ({ value }) =>
              // Input Fileはundefinedを許容しないと使えないので、ここでフォーム送信前のundefinedチェックを挟む
              // もしくはここまではundefined許容したForm用のSchemaを使って、ここで店舗のSchemaでparseするべきかも
              value === undefined
                ? { message: "店舗写真を選択してください" }
                : undefined,
          }}
          children={(field) => (
            <FieldGroup>
              <Field
                orientation="responsive"
                data-invalid={
                  field.state.meta.isTouched && !field.state.meta.isValid
                }
              >
                <FieldLabel htmlFor={field.name}>店舗写真</FieldLabel>
                <FieldContent>
                  <label htmlFor={field.name}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      id={field.name}
                      name={field.name}
                      className="sr-only"
                      onChange={(e) => field.handleChange(e.target.files?.[0])}
                      onBlur={field.handleBlur}
                    />
                    <PreviewImage imageFile={field.state.value} />
                  </label>

                  <FieldError
                    errors={
                      field.state.meta.isTouched ? field.state.meta.errors : []
                    }
                  />
                </FieldContent>
              </Field>
            </FieldGroup>
          )}
        />

        <form.Field
          name="description"
          validators={{
            onChange: CreateStoreForm.entries.description,
          }}
          children={(field) => (
            <FieldGroup>
              <Field
                orientation="responsive"
                data-invalid={
                  field.state.meta.isTouched && !field.state.meta.isValid
                }
              >
                <FieldLabel htmlFor={field.name}>店舗説明</FieldLabel>
                <FieldContent>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  <FieldError
                    errors={
                      field.state.meta.isTouched ? field.state.meta.errors : []
                    }
                  />
                </FieldContent>
              </Field>
            </FieldGroup>
          )}
        />
      </div>

      <form.Subscribe
        selector={(state) => [
          state.canSubmit,
          state.isPristine,
          state.isSubmitting,
          state.isSubmitSuccessful,
        ]}
        children={([canSubmit, isPristine, isSubmitting]) => (
          <div className="mt-7 flex justify-center">
            <SubmitButton
              className="min-w-72"
              type="submit"
              disabled={!canSubmit || isPristine || isSubmitting}
            >
              {isSubmitting ? "送信中" : "この内容で申請する"}
            </SubmitButton>
          </div>
        )}
      />
      {serverError && (
        <FieldError className="my-4 text-center">{serverError}</FieldError>
      )}
    </form>
  );
}
