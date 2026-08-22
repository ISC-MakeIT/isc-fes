"use client";

import { Store } from "@/entities/store";
import { HeadingCard } from "@/shared/ui/heading-card";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { useSuspenseQuery } from "@tanstack/react-query";
import { storeApplicationQueryOptions } from "../api/fetch-store-applications";
import { useState } from "react";
import { Field, FieldContent, FieldLabel } from "@/shared/ui/field";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { STORE_IMAGE_ASPECT } from "@/shared/config";
import { SubmitButton } from "@/shared/ui/submit-button";

export function StoreReview() {
  const { data: stores } = useSuspenseQuery(storeApplicationQueryOptions());
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const selectedStore = stores.find((state) => state.id === selectedStoreId);

  return (
    <div className="grid grid-cols-[1fr_1fr]">
      <div className="space-y-10 px-6 py-18">
        <HeadingCard>店舗一覧</HeadingCard>
        <RadioGroup value={selectedStoreId} onValueChange={setSelectedStoreId}>
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </RadioGroup>
      </div>

      <div className="min-h-screen space-y-10 px-8 py-18 inset-shadow-sm">
        <HeadingCard className="bg-secondary-heading-card">
          店舗情報
        </HeadingCard>

        {selectedStore && (
          <dl className="flex flex-col gap-8">
            <div>
              <SectionHeader>店舗名</SectionHeader>
              <dd>{selectedStore.name}</dd>
            </div>

            <div>
              <SectionHeader>出展教室</SectionHeader>
              <dd>{selectedStore.room}</dd>
            </div>

            <div>
              <SectionHeader>バナー</SectionHeader>
              <dd>
                <AspectRatioImage
                  className="w-96 rounded-sm"
                  ratio={STORE_IMAGE_ASPECT}
                  src={selectedStore.imageUrl}
                  alt={`${selectedStore.name}の店舗画像`}
                />
              </dd>
            </div>

            <div>
              <SectionHeader>店舗説明</SectionHeader>
              <dd>{selectedStore.description}</dd>
            </div>

            {/* TODO:実際の送信処理を実装する */}
            <SubmitButton className="self-center">承認する</SubmitButton>
          </dl>
        )}
      </div>
    </div>
  );
}

type StoreCardProps = {
  store: Store;
};

function StoreCard({ store }: StoreCardProps) {
  return (
    <FieldLabel htmlFor={store.id}>
      <Field orientation="horizontal">
        <FieldContent>
          <p>{store.name}</p>
        </FieldContent>
        <RadioGroupItem value={store.id} id={store.id} />
      </Field>
    </FieldLabel>
  );
}

type SectionHeaderProps = {
  children: React.ReactNode;
};

function SectionHeader({ children }: SectionHeaderProps) {
  return <dt className="mb-2 border-b text-xl">{children}</dt>;
}
