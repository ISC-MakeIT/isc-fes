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
import { storeMemberByAccountIdQueryOptions } from "@/entities/store-member";
import { canDeleteMember } from "../lib/can-delete-member";
import { deleteStoreMemberById } from "../api/delete-store-member-by-id";
import { XIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/shared/ui/dialog";
import { DotText } from "@/shared/ui/dot-text";
import { useState } from "react";
import { AccountRole, currentAccountQueryOptions } from "@/entities/account";
import { trackEvent } from "@/shared/lib/analytics";

const fallbackIcon = "/avatar-fallback.svg";

type StoreMembersSectionProps = {
  storeId: string;
};

export function StoreMembersSection({ storeId }: StoreMembersSectionProps) {
  const { data: currentAccount } = useSuspenseQuery(
    currentAccountQueryOptions(),
  );

  return (
    <div className="border-primary flex flex-col gap-8 px-13 py-8 md:border-l md:px-6">
      <HeadingCard className="self-center">メンバー</HeadingCard>
      {currentAccount && (
        <StoreMemberList
          accountId={currentAccount.id}
          storeId={storeId}
          isAdmin={currentAccount.role === AccountRole.Admin}
        />
      )}
    </div>
  );
}

type StoreMemberListProps = {
  isAdmin: boolean;
  storeId: string;
  accountId: string;
};

function StoreMemberList({
  storeId,
  accountId,
  isAdmin,
}: StoreMemberListProps) {
  const { data: members } = useSuspenseQuery(storeMemberQueryOptions(storeId));
  const { data: currentMember } = useSuspenseQuery(
    storeMemberByAccountIdQueryOptions(storeId, accountId),
  );

  // 未所属の一般アカウントはサーバー側でもアクセスを拒否する。
  if (!currentMember && !isAdmin) {
    return <p>この店舗にはアクセスできません。店舗一覧へ移動します。</p>;
  }

  return (
    <>
      <div className="space-y-5">
        {members.map((m) => (
          <MemberCard
            key={m.accountId}
            storeId={storeId}
            member={m}
            canDelete={canDeleteMember({
              currentAccountId: accountId,
              canManageMembers:
                isAdmin || currentMember?.role === StoreMemberRole.Manager,
              targetMember: m,
            })}
          />
        ))}
      </div>

      {(isAdmin || currentMember?.role === StoreMemberRole.Manager) && (
        <StoreInvitationDialog storeId={storeId} />
      )}
    </>
  );
}

type MemberCardProps = {
  storeId: string;
  member: StoreMember;
  canDelete: boolean;
};

function MemberCard({ storeId, member, canDelete }: MemberCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: deleteStoreMemberById,
    onSuccess: async () => {
      trackEvent("store_member_removed", { store_id: storeId });
      setIsDeleteDialogOpen(false);
      await queryClient.invalidateQueries({
        queryKey: storeMembersKey(storeId),
      });
    },
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

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogTrigger
          disabled={!canDelete || mutation.isPending}
          render={<Button variant="ghost" />}
        >
          <XIcon className="text-close-button size-7" strokeWidth={4} />
        </DialogTrigger>

        <DialogContent className="shadow-dialog-primary flex flex-col gap-6 px-14 pt-18 pb-4.5 text-center">
          <p className="text-xl">
            {member.displayName}
            <br />
            上記のメンバーを<span className="text-notice">削除</span>しますか？
          </p>

          {mutation.error && (
            <p role="alert" className="text-notice text-sm">
              {mutation.error.message}
            </p>
          )}

          <Button
            variant="destructive"
            className="h-auto self-center px-14 py-3 text-xl"
            disabled={mutation.isPending}
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
