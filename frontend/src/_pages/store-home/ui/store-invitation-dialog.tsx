"use client";

import { SelectItems } from "@/shared/model/select-item";
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
import { SubmitButton } from "@/shared/ui/submit-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { PlusIcon } from "lucide-react";
import { createStoreInvitationUrl } from "../api/create-store-invitation-url";

const items: { label: string; value: string | null }[] = [
  { label: "無制限", value: null },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "5", value: "5" },
  { label: "10", value: "10" },
];
const tabItems: { label: string; value: string; content: React.ReactNode }[] = [
  {
    label: "管理者",
    value: "admin",
    content: (
      <>
        <p>メニューの管理などが行えます。</p>
        <p className="text-red-500">※クラス委員のみを推奨</p>
      </>
    ),
  },
  {
    label: "メンバー",
    value: "member",
    content: <p>注文の確認や商品の受け渡しを行えます</p>,
  },
];

type StoreInvitationDialogProps = {
  storeId: string;
};

export function StoreInvitationDialog({ storeId }: StoreInvitationDialogProps) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <SubmitButton className="py-2 text-lg font-bold" isDot={false} />
        }
      >
        <PlusIcon className="size-6" />
        メンバーを招待
      </DialogTrigger>

      <DialogContent className="shadow-dialog-primary flex flex-col px-14 pt-18 pb-8 sm:max-w-md">
        <DialogTitle className="self-center text-[1.375rem]">
          メンバーを招待する
        </DialogTitle>
        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <Label htmlFor="usage-count" className="px-4 text-base">
              利用回数
            </Label>
            <Select items={items}>
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
                  {items.map((item) => (
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
            <Tabs defaultValue={tabItems[0]?.value}>
              <TabsList className="border-primary w-full rounded-full border group-data-horizontal/tabs:h-12">
                {tabItems.map((item) => (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="data-active:bg-primary data-active:text-primary-foreground data-active:hover:text-primary-foreground rounded-full"
                  >
                    <DotText className="text-base">{item.label}</DotText>
                  </TabsTrigger>
                ))}
              </TabsList>
              {tabItems.map((item) => (
                <TabsContent key={item.value} value={item.value}>
                  {item.content}
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <SubmitButton
            className="self-center px-14 py-3 text-xl shadow-none"
            onClick={}
          >
            招待リンクをコピー
          </SubmitButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
