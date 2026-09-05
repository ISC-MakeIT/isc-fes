"use client";

import { HeadingCard } from "@/shared/ui/heading-card";
import { MenuFormFields } from "./menu-form-fields";
import { createMenu, CreateMenuInput } from "../api/create-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ActionButton } from "@/shared/ui/action-button";
import { storeMenusKey } from "@/shared/config";
import { useEffect } from "react";
import { v } from "@/shared/lib/valibot";
import { useStoreId } from "../model/hooks/use-store-id";
import { useAppForm } from "@/shared/lib/form-hook";
import { menuFormOptions } from "../model/menu-form";

export function CreateMenuForm() {
  const storeId = useStoreId();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: createMenu,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: storeMenusKey(storeId) });
    },
  });

  const form = useAppForm({
    ...menuFormOptions,

    validators: {
      ...menuFormOptions.validators,
      onSubmit: CreateMenuInput,
    },

    onSubmit: async (values) => {
      const createMenuInput = v.parse(CreateMenuInput, values);
      await mutation.mutateAsync({ storeId, createMenuInput });
    },
  });

  useEffect(() => {
    if (mutation.isSuccess) {
      form.reset();
    }
  }, [form, mutation.isSuccess]);

  return (
    <div className="space-y-10">
      <HeadingCard className="bg-secondary-heading-card px-8 py-4">
        メニューの追加
      </HeadingCard>

      <form
        className="flex flex-col items-center gap-10"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <MenuFormFields form={form} />

        {mutation.error && (
          <p role="alert" className="text-notice">
            {mutation.error.message}
          </p>
        )}

        <ActionButton
          disabled={mutation.isPending}
          type="submit"
          className="px-14 py-4 text-xl"
        >
          メニューを追加
        </ActionButton>
      </form>
    </div>
  );
}
