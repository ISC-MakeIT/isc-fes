"use client";

import { useForm } from "@tanstack/react-form";
import { CreateStoreForm, ImageSchema } from "../model/types";
import { createStoreApplication } from "../api/create-store-application";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Field, FieldError, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { GENERIC_ERROR_MESSAGE, isClientError } from "@/shared/config";
import { v } from "@/shared/lib/valibot";

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
    validators: {
      onMount: CreateStoreForm,
    },
    onSubmit: async ({ value }) => {
      if (!value.image) return { message: "店舗写真を選択してください" };
      const { data, error, response } = await createStoreApplication(value);

      // TODO: 新規作成が成功したら完了ページにリダイレクト
      if (data) return;

      // 何も言わずに遷移するのは入力した値を捨ててしまい不親切そうなので、基本エラーメッセージを表示する対応にしている
      // 未ログインなら基本proxy, layoutの段階でredirectされるはず
      if (isClientError(response.status)) setServerError(error);

      // クライアント以外のエラーは汎用的なエラーメッセージにする
      else setServerError(GENERIC_ERROR_MESSAGE);
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
        <form.Field
          name="name"
          validators={{ onChange: CreateStoreForm.entries.name }}
          children={(field) => (
            <Field
              data-invalid={
                field.state.meta.isTouched && !field.state.meta.isValid
              }
            >
              <FieldLabel htmlFor={field.name}>店舗名</FieldLabel>
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
            </Field>
          )}
        />
        <form.Field
          name="room"
          validators={{ onChange: CreateStoreForm.entries.room }}
          children={(field) => (
            <Field
              data-invalid={
                field.state.meta.isTouched && !field.state.meta.isValid
              }
            >
              <FieldLabel htmlFor={field.name}>教室</FieldLabel>
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
            </Field>
          )}
        />
        <form.Field
          name="description"
          validators={{
            onChange: CreateStoreForm.entries.description,
            onSubmit: ({ value }) =>
              // Input Fileはundefinedを許容しないと使えないので、ここでフォーム送信前のundefinedチェックを挟む
              // もしくはここまではundefined許容したForm用のSchemaを使って、ここで店舗のSchemaでparseするべきかも
              value === undefined
                ? { message: "店舗写真を選択してください" }
                : undefined,
          }}
          children={(field) => (
            <Field
              data-invalid={
                field.state.meta.isTouched && !field.state.meta.isValid
              }
            >
              <FieldLabel htmlFor={field.name}>店舗説明</FieldLabel>
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
            </Field>
          )}
        />

        <form.Field
          name="image"
          validators={{
            onChange: ({ value }) =>
              v.safeParse(ImageSchema, value).issues?.[0],
            onMount: ({ value }) => v.safeParse(ImageSchema, value).issues?.[0],
          }}
          children={(field) => (
            <Field
              data-invalid={
                field.state.meta.isTouched && !field.state.meta.isValid
              }
            >
              <FieldLabel htmlFor={field.name}>店舗写真</FieldLabel>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                id={field.name}
                name={field.name}
                onChange={(e) => field.handleChange(e.target.files?.[0])}
                onBlur={field.handleBlur}
              />
              <FieldError
                errors={
                  field.state.meta.isTouched ? field.state.meta.errors : []
                }
              />
            </Field>
          )}
        />

        <form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isPristine,
            state.isSubmitting,
            state.isSubmitSuccessful,
          ]}
          children={([
            canSubmit,
            isPristine,
            isSubmitting,
            isSubmitSuccessful,
          ]) => (
            <Button
              type="submit"
              disabled={
                !canSubmit || isPristine || isSubmitting || isSubmitSuccessful
              }
            >
              {isSubmitSuccessful ? "送信完了" : "この内容で送信"}
            </Button>
          )}
        />
      </form>
    </>
  );
}
