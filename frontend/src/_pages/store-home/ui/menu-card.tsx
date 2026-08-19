import { AspectRatio } from "@/shared/ui/aspect-ratio";
import { Card } from "@/shared/ui/card";
import { formatYen } from "../lib/formatYen";
import Image from "next/image";
import { Menu } from "@/entities/menu";

type MenuCard = {
  menu: Menu;
};

export function MenuCard({ menu }: MenuCard) {
  return (
    <Card className="shadow-primary border-foreground gap-6 rounded-sm border px-4 py-6 shadow-[8px_8px_0_0]">
      <AspectRatio className="h-30" ratio={5 / 4}>
        <Image
          fill
          className="object-cover"
          src={menu.imageUrl}
          alt="メニューの画像"
        />
      </AspectRatio>
      <div className="space-y-2">
        <p className="line-clamp-2 h-[2lh] font-bold">{menu.name}</p>
        <p className="text-lg font-bold">{formatYen(menu.unitPrice)}</p>
      </div>
    </Card>
  );
}
