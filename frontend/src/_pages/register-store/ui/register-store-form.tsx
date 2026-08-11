"use client";

import { useForm } from "@tanstack/react-form";
import { CreateStoreForm, ImageSchema } from "../model/types";
import { createStoreApplication } from "../api/create-store-application";
import { useState } from "react";
import { Field, FieldContent, FieldError, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { GENERIC_ERROR_MESSAGE, isClientError } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { Card } from "@/shared/ui/card";
import { DotText } from "@/shared/ui/dot-text";
import { Textarea } from "@/shared/ui/textarea";
import { PreviewImage } from "./preview-image";
import { SubmitButton } from "@/shared/ui/submit-button";

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
      if (isClientError(response.status)) {
        setServerError(error);
      } else {
        // クライアント以外のエラーは汎用的なエラーメッセージにする
        setServerError(GENERIC_ERROR_MESSAGE);
      }
    },
  });

  return (
    <div className="mx-6 my-8 flex flex-col space-y-8 sm:mx-32">
      <div className="flex flex-col items-center space-y-4">
        <HeadingCard>店舗登録</HeadingCard>
        <p className="text-sm">
          この情報は、モバイルオーダーの画面にも使用されます
        </p>
      </div>

      {serverError && <FieldError>{serverError}</FieldError>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div className="grid grid-cols-[6rem_1fr] items-start gap-x-4 gap-y-6">
          <form.Field
            name="name"
            validators={{ onChange: CreateStoreForm.entries.name }}
            children={(field) => (
              <Field
                className="contents"
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
            )}
          />
          <form.Field
            name="room"
            validators={{ onChange: CreateStoreForm.entries.room }}
            children={(field) => (
              <Field
                className="contents"
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
                className="contents"
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
            )}
          />

          <form.Field
            name="image"
            validators={{
              onChange: ({ value }) =>
                v.safeParse(ImageSchema, value).issues?.[0],
              onMount: ({ value }) =>
                v.safeParse(ImageSchema, value).issues?.[0],
            }}
            children={(field) => (
              <Field
                className="contents"
                data-invalid={
                  field.state.meta.isTouched && !field.state.meta.isValid
                }
              >
                <FieldLabel htmlFor={field.name}>店舗写真</FieldLabel>
                <FieldContent>
                  <label htmlFor={field.name} className="cursor-pointer">
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      id={field.name}
                      name={field.name}
                      className="sr-only"
                      onChange={(e) => field.handleChange(e.target.files?.[0])}
                      onBlur={field.handleBlur}
                    />
                    <PreviewImage image={field.state.value} />
                  </label>

                  <FieldError
                    errors={
                      field.state.meta.isTouched ? field.state.meta.errors : []
                    }
                  />
                </FieldContent>
              </Field>
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
          children={([
            canSubmit,
            isPristine,
            isSubmitting,
            isSubmitSuccessful,
          ]) => (
            <div className="mt-7 flex justify-center">
              <SubmitButton
                type="submit"
                disabled={
                  !canSubmit || isPristine || isSubmitting || isSubmitSuccessful
                }
              >
                {isSubmitSuccessful ? "送信完了" : "この内容で送信"}
              </SubmitButton>
            </div>
          )}
        />
      </form>
      <p className="text-center text-sm">
        登録内容は変更できません。変更したい場合は管理者に連絡してください。
      </p>
    </div>
  );
}

type HeadingCardProps = {
  children: React.ReactNode;
};

function HeadingCard({ children }: HeadingCardProps) {
  return (
    <Card className="bg-primary mx-auto rounded-sm px-6 py-2 text-center text-2xl text-white shadow-[7px_7px_0_rgb(254,218,62)]">
      <DotText>
        <h1>{children}</h1>
      </DotText>
    </Card>
  );
}
