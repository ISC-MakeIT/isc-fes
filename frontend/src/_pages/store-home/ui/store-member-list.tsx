"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { storeMemberQueryOptions } from "../api/fetch-store-members";
import { StoreMember } from "@/entities/store-member";
import { HeadingCard } from "@/shared/ui/heading-card";
import { Card } from "@/shared/ui/card";
import { AspectRatio } from "@/shared/ui/aspect-ratio";
import Image from "next/image";
import { Button } from "@/shared/ui/button";
import { SubmitButton } from "@/shared/ui/submit-button";
import { PlusIcon } from "lucide-react";

const placeholderIcon = "/avatar-placeholder.svg";

type StoreMemberListProps = {
  storeId: string;
};

export function StoreMemberList({ storeId }: StoreMemberListProps) {
  const { data: members } = useSuspenseQuery(storeMemberQueryOptions(storeId));
  return (
    <div className="border-primary flex flex-col items-center gap-8 px-13 pt-8 md:border-l md:px-6">
      <HeadingCard>メンバー</HeadingCard>

      <div className="self-stretch">
        {members.map((m) => (
          <MemberCard key={m.accountId} member={m} />
        ))}
      </div>

      <SubmitButton
        className="self-stretch py-2 text-lg font-bold"
        isDot={false}
      >
        <PlusIcon className="size-6" />
        メンバーを招待
      </SubmitButton>
    </div>
  );
}

type MemberCardProps = {
  member: StoreMember;
};

function MemberCard({ member }: MemberCardProps) {
  return (
    <div className="grid grid-cols-[1fr_2.5rem] items-center gap-2">
      <Card className="border-primary flex flex-row items-center gap-6 rounded-sm border-2 px-2 py-1">
        <AspectRatio ratio={1}>
          <Image
            width={50}
            height={50}
            className="rounded-full object-cover"
            src={placeholderIcon}
            alt={`${member.displayName}さんのアイコン画像`}
          />
        </AspectRatio>
        <p className="text-base">{member.displayName}</p>
      </Card>
      {/* TODO: アカウントを判定して、削除ボタンのだし分けをする */}
      <Button variant="ghost" className="text-4xl font-bold text-[#EA6082]">
        ×
      </Button>
    </div>
  );
}
