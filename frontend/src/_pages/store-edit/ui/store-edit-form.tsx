"use client";

import {
  allergenBadgeVariants,
  allergenQueryOptions,
} from "@/entities/allergen";
import { activeRoomsQueryOptions } from "@/entities/room";
import type { Store } from "@/entities/store";
import {
  STORE_IMAGE_ASPECT,
  storeDetailKey,
  storeHomeUrl,
  storeListKeys,
} from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { trackEvent } from "@/shared/lib/analytics";
import { cn } from "@/shared/lib/utils";
import { ActionButton } from "@/shared/ui/action-button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/ui/combobox";
import { Field, FieldContent, FieldError, FieldLabel } from "@/shared/ui/field";
import { PreviewImage } from "@/shared/ui/preview-image";
import { Textarea } from "@/shared/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { updateStore } from "../api/update-store";
import { buildStoreUpdateInput } from "../lib/build-store-update-input";
import { StoreEditFormValues } from "../model/types";

type StoreEditFormProps = { storeId: string; initialStore: Store };

export function StoreEditForm({ storeId, initialStore }: StoreEditFormProps) {
  const store = initialStore;
  const router = useRouter();
  const { data: rooms } = useSuspenseQuery(activeRoomsQueryOptions());
  const { data: allergens } = useSuspenseQuery(allergenQueryOptions());
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: updateStore });

  const initialValues = useRef<StoreEditFormValues>({
    room: store.room,
    description: store.description,
    allergenIds: store.allergens.map((allergen) => allergen.id),
    image: undefined,
  });
  const roomChoices = rooms.includes(store.room)
    ? rooms
    : [store.room, ...rooms];

  const form = useForm({
    defaultValues: initialValues.current,
    validators: {
      onMount: StoreEditFormValues,
      onChange: StoreEditFormValues,
      onSubmit: StoreEditFormValues,
    },
    onSubmit: async ({ value }) => {
      const current = v.parse(StoreEditFormValues, value);
      const initial = initialValues.current;
      const input = buildStoreUpdateInput(initial, current);
      if (Object.keys(input).length === 0 && !current.image) return;

      const updated = await mutation.mutateAsync({
        storeId,
        input,
        image: current.image,
      });
      trackEvent("store_profile_updated", { store_id: storeId });
      queryClient.setQueryData(storeDetailKey(storeId), updated);
      await queryClient.invalidateQueries({ queryKey: storeListKeys.all() });
      router.push(storeHomeUrl(storeId));
    },
  });

  const fieldLayout =
    "grid w-full grid-cols-[6.25rem_minmax(0,1fr)] items-start gap-y-8 md:grid-cols-[6.25rem_minmax(0,27.5rem)]";
  const inputStyle = "border border-primary rounded-sm";

  return (
    <form
      className="flex w-full max-w-135 flex-col items-center gap-8 md:gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <div className={cn(fieldLayout, "min-h-29 gap-y-2 md:min-h-0")}>
        <form.Field name="room">
          {(field) => (
            <Field
              className="contents"
              data-invalid={
                field.state.meta.isTouched && !field.state.meta.isValid
              }
            >
              <FieldLabel htmlFor={field.name} className="max-md:text-base">
                出店教室
              </FieldLabel>
              <FieldContent>
                <Combobox
                  items={roomChoices}
                  value={field.state.value}
                  onValueChange={(room) =>
                    field.handleChange(room ?? store.room)
                  }
                >
                  <ComboboxInput
                    id={field.name}
                    name={field.name}
                    className={cn(inputStyle, "max-md:[&_input]:text-lg")}
                    onBlur={field.handleBlur}
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>教室が見つかりません</ComboboxEmpty>
                    <ComboboxList>
                      {(room) => (
                        <ComboboxItem key={room} value={room}>
                          {room}
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
        </form.Field>

        <span className="text-base font-medium">店舗名</span>
        <p className="min-w-0 text-lg break-words max-md:leading-[1.2]">
          {store.name}
        </p>
        <p className="text-notice col-start-2 text-sm">
          ※店舗名の変更は管理者へご連絡ください。
        </p>
      </div>

      <div className={fieldLayout}>
        <form.Field name="image">
          {(field) => (
            <Field
              className="contents"
              data-invalid={
                field.state.meta.isTouched && !field.state.meta.isValid
              }
            >
              <FieldLabel htmlFor={field.name} className="max-md:text-base">
                バナー
              </FieldLabel>
              <FieldContent>
                <label htmlFor={field.name} className="cursor-pointer">
                  <input
                    type="file"
                    id={field.name}
                    name={field.name}
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) =>
                      field.handleChange(event.target.files?.[0])
                    }
                    onBlur={field.handleBlur}
                  />
                  <PreviewImage
                    imageFile={field.state.value}
                    imagePath={store.imageUrl}
                    ratio={STORE_IMAGE_ASPECT}
                    alt="店舗のバナー"
                    className={inputStyle}
                  />
                </label>
                {field.state.meta.isTouched && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </FieldContent>
            </Field>
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => (
            <Field
              className="contents"
              data-invalid={
                field.state.meta.isTouched && !field.state.meta.isValid
              }
            >
              <FieldLabel htmlFor={field.name} className="max-md:text-base">
                店舗説明
              </FieldLabel>
              <FieldContent>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  className={cn(inputStyle, "min-h-63 resize-y")}
                />
                {field.state.meta.isTouched && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </FieldContent>
            </Field>
          )}
        </form.Field>

        <form.Field name="allergenIds">
          {(field) => (
            <Field className="contents">
              <FieldLabel className="max-md:text-base">アレルギー</FieldLabel>
              <FieldContent>
                <ToggleGroup
                  multiple
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  className="grid w-full max-w-53 grid-cols-2 gap-4 md:max-w-none md:grid-cols-4"
                  aria-label="アレルギー対象品目"
                >
                  {allergens.map((allergen) => (
                    <ToggleGroupItem
                      key={allergen.id}
                      value={allergen.id}
                      className={cn(
                        allergenBadgeVariants(),
                        "data-pressed:bg-allergen-card data-pressed:text-primary-foreground h-[39px] w-full rounded-sm text-base font-normal md:h-8 md:text-sm md:font-medium",
                      )}
                    >
                      {allergen.name}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FieldContent>
            </Field>
          )}
        </form.Field>
      </div>

      {mutation.isError && (
        <p role="alert" className="text-notice">
          {mutation.error.message}
        </p>
      )}
      <form.Subscribe
        selector={(state) => [
          state.canSubmit,
          state.isDefaultValue,
          state.isSubmitting,
        ]}
      >
        {([canSubmit, isDefaultValue, isSubmitting]) => (
          <ActionButton
            type="submit"
            disabled={
              !canSubmit ||
              isDefaultValue ||
              isSubmitting ||
              mutation.isPending ||
              mutation.isSuccess
            }
            className="mt-12 rounded-lg px-14 py-4 text-lg max-md:leading-5 md:mt-4"
          >
            この内容で保存する
          </ActionButton>
        )}
      </form.Subscribe>
    </form>
  );
}
