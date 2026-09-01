"use client";

import { StoreMemberRole } from "@/entities/store-member";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { DotText } from "@/shared/ui/dot-text";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { ActionButton } from "@/shared/ui/action-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useMutation } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { createStoreInvitationUrl } from "../api/create-store-invitation-url";

const COPY_FEEDBACK_DURATION_MS = 2 * 1000; // 2秒

const maxUsesOptions: { label: string; value: number | null }[] = [
  { label: "無制限", value: null },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "5", value: 5 },
  { label: "10", value: 10 },
] as const;

const roleTabOptions: {
  label: string;
  value: string;
  content: React.ReactNode;
}[] = [
  {
    label: "管理者",
    value: StoreMemberRole.Manager,
    content: (
      <>
        <p>メニューの管理などが行えます。</p>
        <p className="text-notice">※クラス委員のみを推奨</p>
      </>
    ),
  },
  {
    label: "メンバー",
    value: StoreMemberRole.Staff,
    content: <p>注文の確認や商品の受け渡しを行えます</p>,
  },
] as const;

type StoreInvitationDialogProps = {
  storeId: string;
};

export function StoreInvitationDialog({ storeId }: StoreInvitationDialogProps) {
  const mutation = useMutation({
    mutationFn: createStoreInvitationUrl,
  });

  const [selectedUsageCount, setSelectedUsageCount] = useState<number | null>(
    null,
  );
  const [selectedRole, setSelectedRole] = useState<StoreMemberRole>(
    StoreMemberRole.Manager,
  );
  const [isCopied, setIsCopied] = useState(false);

  const isDirty =
    !mutation.isSuccess ||
    mutation.variables.maxUses !== selectedUsageCount ||
    mutation.variables.role !== selectedRole;

  const isCopyButtonDisabled = mutation.isPending || isCopied;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCopyInvitationUrl() {
    setErrorMessage(null);

    try {
      const url = isDirty
        ? await mutation.mutateAsync({
            origin: location.origin,
            storeId,
            maxUses: selectedUsageCount,
            role: selectedRole,
          })
        : mutation.data;

      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPY_FEEDBACK_DURATION_MS);
    } catch {
      setErrorMessage("招待リンクをコピーできませんでした。");
    }
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <ActionButton className="py-2 text-lg font-bold" isDot={false} />
        }
      >
        <PlusIcon className="size-6" />
        メンバーを招待
      </DialogTrigger>

      <DialogContent className="shadow-dialog-primary flex flex-col px-14 pt-18 pb-8">
        <DialogTitle className="self-center text-[1.375rem]">
          メンバーを招待する
        </DialogTitle>
        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <Label htmlFor="usage-count" className="px-4 text-base">
              利用回数
            </Label>
            <Select
              items={maxUsesOptions}
              value={selectedUsageCount}
              onValueChange={setSelectedUsageCount}
            >
              <SelectTrigger
                id="usage-count"
                className="border-primary w-full rounded-full border py-5"
              >
                <SelectValue
                  className="justify-center text-base"
                  render={<DotText />}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {maxUsesOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      <DotText className="text-base">{item.label}</DotText>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="px-4 text-base">招待するメンバーの役割</Label>
            <Tabs
              value={selectedRole}
              onValueChange={setSelectedRole}
              defaultValue={roleTabOptions[0]?.value}
            >
              <TabsList className="border-primary w-full rounded-full border group-data-horizontal/tabs:h-12">
                {roleTabOptions.map((item) => (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="data-active:bg-primary data-active:text-primary-foreground data-active:hover:text-primary-foreground rounded-full"
                  >
                    <DotText className="text-base">{item.label}</DotText>
                  </TabsTrigger>
                ))}
              </TabsList>
              {roleTabOptions.map((item) => (
                <TabsContent key={item.value} value={item.value}>
                  {item.content}
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {errorMessage && (
            <p role="alert" className="text-notice text-center">
              {errorMessage}
            </p>
          )}

          <ActionButton
            className="self-center px-14 py-3 text-xl shadow-none"
            onClick={handleCopyInvitationUrl}
            disabled={isCopyButtonDisabled}
          >
            {isCopied ? "コピーしました！" : "招待リンクをコピー"}
          </ActionButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
