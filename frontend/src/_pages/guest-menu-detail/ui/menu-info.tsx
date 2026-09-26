import { Menu } from "@/entities/menu";
import { MENU_IMAGE_ASPECT } from "@/shared/config";
import { formatYen } from "@/shared/lib/formatYen";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";

type MenuInfoProps = {
  menu: Menu;
};

export function MenuInfo({ menu }: MenuInfoProps) {
  return (
    <section className="space-y-8">
      <AspectRatioImage
        src={menu.imageUrl}
        ratio={MENU_IMAGE_ASPECT}
        alt={`${menu.name}の画像`}
        className="mx-auto w-full rounded-sm md:max-w-75"
      />
      <div className="space-y-8 md:space-y-6">
        <h1 className="text-[1.375rem] font-bold md:text-center">
          {menu.name}
        </h1>
        <h2 className="text-[1.375rem] font-bold">
          {formatYen(menu.unitPrice)}
        </h2>
        <p className="text-lg">{menu.description}</p>
      </div>
    </section>
  );
}
