"use client";

import { menuToppingsQueryOptions } from "@/entities/topping";
import { formatYen } from "@/shared/lib/formatYen";
import { cn } from "@/shared/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { trackEvent } from "@/shared/lib/analytics";

type ToppingSelectorType = {
  storeId: string;
  menuId: string;
};

export function ToppingSelector({ storeId, menuId }: ToppingSelectorType) {
  const [selectedToppingIds, setSelectedToppingIds] = useState<string[]>([]);
  const { data: toppings } = useSuspenseQuery(
    menuToppingsQueryOptions({ storeId, menuId }),
  );

  return (
    <div className="space-y-4.5 md:px-6">
      <h2 className="border-foreground w-full border-b text-xl">
        カスタマイズ
      </h2>
      <ToggleGroup
        multiple
        value={selectedToppingIds}
        onValueChange={(nextIds) => {
          const changedId =
            nextIds.find((id) => !selectedToppingIds.includes(id)) ??
            selectedToppingIds.find((id) => !nextIds.includes(id));
          if (changedId) {
            trackEvent("topping_selection_changed", {
              store_id: storeId,
              menu_id: menuId,
              topping_id: changedId,
              selected: nextIds.includes(changedId),
            });
          }
          setSelectedToppingIds(nextIds);
        }}
        orientation="vertical"
        className="flex w-full flex-col gap-4"
      >
        {toppings.map((topping) => (
          <ToggleGroupItem
            key={topping.id}
            value={topping.id}
            className={cn(
              "border-primary flex h-auto w-full flex-row justify-start gap-3 rounded-sm border-2 px-4 py-2",
              "data-pressed:bg-primary data-pressed:text-primary-foreground",
            )}
          >
            <span>
              <PlusIcon
                aria-hidden
                className="block size-5 group-data-pressed/toggle:hidden"
              />
              <MinusIcon
                aria-hidden
                className="hidden size-5 group-data-pressed/toggle:block"
              />
            </span>
            <div className="min-w-0 gap-3 space-y-3 text-left text-lg">
              <p className="truncate">{topping.name}</p>
              <p>{formatYen(topping.unitPrice)}</p>
            </div>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
