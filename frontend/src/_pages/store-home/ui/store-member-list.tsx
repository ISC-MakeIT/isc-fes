"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { storeMemberQueryOptions } from "../api/fetch-store-members";
import { StoreMember, StoreMemberRole } from "@/entities/store-member";
import { HeadingCard } from "@/shared/ui/heading-card";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { ICON_IMAGE_ASPECT, storeMembersKey } from "@/shared/config";
import { StoreInvitationDialog } from "./store-invitation-dialog";
import { storeMemberByAccountIdQueryOptions } from "../api/fetch-store-member-by-id";
import { canDeleteMember } from "../lib/can-delete-member";
import { deleteStoreMemberById } from "../api/delete-store-member-by-id";
import { XIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/shared/ui/dialog";
import { DotText } from "@/shared/ui/dot-text";

const fallbackIcon = "/avatar-fallback.svg";

type StoreMemberListProps = {
  storeId: string;
  accountId: string;
};

export function StoreMemberList({ storeId, accountId }: StoreMemberListProps) {
  const { data: members } = useSuspenseQuery(storeMemberQueryOptions(storeId));
  const { data: currentMember } = useSuspenseQuery(
    storeMemberByAccountIdQueryOptions(storeId, accountId),
  );

  return (
    <div className="border-primary flex flex-col gap-8 px-13 py-8 md:border-l md:px-6">
      <HeadingCard className="self-center">メンバー</HeadingCard>

      <div className="space-y-5">
        {members.map((m) => (
          <MemberCard
            key={m.accountId}
            storeId={storeId}
            member={m}
            currentMember={currentMember}
          />
        ))}
      </div>

      {currentMember.role === StoreMemberRole.Manager && (
        <StoreInvitationDialog storeId={storeId} />
      )}
    </div>
  );
}

type MemberCardProps = {
  storeId: string;
  member: StoreMember;
  currentMember: StoreMember;
};

function MemberCard({ storeId, member, currentMember }: MemberCardProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: deleteStoreMemberById,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: storeMembersKey(storeId),
      });
    },
  });

  const canDelete = canDeleteMember({
    currentMember,
    targetMember: member,
  });

  return (
    <div className="grid grid-cols-[1fr_2.5rem] items-center gap-2">
      <Card className="border-primary flex flex-row items-center gap-6 rounded-sm border-2 px-2 py-1">
        <AspectRatioImage
          className="w-12.5 rounded-full"
          ratio={ICON_IMAGE_ASPECT}
          src={member.pictureUrl ?? fallbackIcon}
          alt={`${member.displayName}さんのアイコン画像`}
        />
        <p className="text-base">{member.displayName}</p>
      </Card>

      <Dialog>
        <DialogTrigger
          disabled={!canDelete || mutation.isPending}
          render={<Button variant="ghost" />}
        >
          <XIcon className="text-close-button size-7" strokeWidth={4} />
        </DialogTrigger>

        <DialogContent className="shadow-dialog-primary flex flex-col gap-6 px-14 pt-18 pb-4.5 text-center text-xl">
          <p>
            {member.displayName}
            <br />
            上記のメンバーを<span className="text-notice">削除</span>しますか？
          </p>
          {mutation.error && (
            <p role="alert" className="text-notice">
              {mutation.error.message}
            </p>
          )}
          <Button
            className="bg-destructive h-auto self-center px-14 py-3 text-xl"
            disabled={!canDelete || mutation.isPending}
            onClick={() =>
              mutation.mutate({ storeId, accountId: member.accountId })
            }
          >
            <DotText>削除する</DotText>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
