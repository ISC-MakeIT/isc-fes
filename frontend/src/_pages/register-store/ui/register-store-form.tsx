"use client";

import { useForm } from "@tanstack/react-form";
import { CreateStoreForm, CreateStoreInput } from "../model/types";
import { createStoreApplication } from "../api/create-store-application";
import { Field, FieldContent, FieldError, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { PreviewImage } from "@/shared/ui/preview-image";
import { ActionButton } from "@/shared/ui/action-button";
import { useRouter } from "next/navigation";
import { STORE_IMAGE_ASPECT, storeListUrl } from "@/shared/config";
import { UploadImage } from "@/shared/model";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { v } from "@/shared/lib/valibot";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/ui/combobox";
import { activeRoomsQueryOptions } from "@/entities/room";
import { cn } from "@/shared/lib/utils";

const defaultFormValue: CreateStoreForm = {
  name: "",
  room: undefined,
  description: "",
  image: undefined,
};

export function RegisterStoreForm() {
  const router = useRouter();

  const { data: activeRooms } = useSuspenseQuery(activeRoomsQueryOptions());

  const mutation = useMutation({
    mutationFn: createStoreApplication,
    onSuccess: () => {
      router.push(storeListUrl());
    },
  });

  const form = useForm({
    defaultValues: defaultFormValue,
    validators: {
      onMount: CreateStoreForm,
    },
    onSubmit: async ({ value }) => {
      const createStoreInput = v.parse(CreateStoreInput, value);
      await mutation.mutateAsync({ createStoreInput });
    },
  });

  const inputStyle = "border border-primary rounded-sm";

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <div className="grid grid-cols-[6.25rem_minmax(0,27.5rem)] items-start gap-x-4 gap-y-6">
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
                  className={inputStyle}
                />

                {field.state.meta.isTouched && (
                  <FieldError errors={field.state.meta.errors} />
                )}
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
                <Combobox
                  items={activeRooms}
                  value={field.state.value ?? null}
                  onValueChange={(value) => {
                    field.handleChange(value ?? undefined);
                  }}
                >
                  <ComboboxInput className={inputStyle} />
                  <ComboboxContent>
                    <ComboboxEmpty>教室が見つかりません</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>

                {field.state.meta.isTouched && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </FieldContent>
            </Field>
          )}
        />

        <form.Field
          name="image"
          validators={{
            onChange: UploadImage,
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
                    imageFile={field.state.value}
                    alt="店舗の写真"
                    ratio={STORE_IMAGE_ASPECT}
                    className={inputStyle}
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
          name="description"
          validators={{
            onChange: CreateStoreForm.entries.description,
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
                  className={inputStyle}
                />

                {field.state.meta.isTouched && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </FieldContent>
            </Field>
          )}
        />
      </div>

      <p className="text-sm">
        登録内容は変更できません。
        <br />
        変更したい場合は管理者に連絡してください。
      </p>
      <form.Subscribe
        selector={(state) => [
          state.canSubmit,
          state.isPristine,
          state.isSubmitting,
        ]}
        children={([canSubmit, isPristine, isSubmitting]) => (
          <ActionButton
            type="submit"
            disabled={!canSubmit || isPristine || isSubmitting}
            className="px-14 py-4 text-lg"
          >
            {isSubmitting ? "送信中" : "この内容で申請する"}
          </ActionButton>
        )}
      />

      {mutation.isError && <FieldError>{mutation.error.message}</FieldError>}
    </form>
  );
}
